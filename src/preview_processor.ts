import {
    SyntaxNodeRef
} from '@lezer/common';

import {
    Range,
    RangeSetBuilder,
    EditorState,
    StateField,
    Extension,
    Transaction
} from '@codemirror/state';

import {
    PluginValue,
    ViewPlugin,
    EditorView,
    ViewUpdate,
    WidgetType,
    Decoration,
    DecorationSet
} from '@codemirror/view';

import { syntaxTree } from '@codemirror/language';

import ImageCaptionPlugin from './main';
import {
    parseCaptionText,
    addCaption,
    setSize,
    updateFigureIndices,
} from './common';


// *******************
// *** Definitions ***
// *******************

/**
 * Alias for arguments needed to create a decoration.
 */
type RangeSetBuilderArgs = { from: number, to: number, value: Decoration}


/**
 * Id of the `node.type.props` storing relevant information.
 */
const NODE_TYPE_PROP_ID = 11;


// ************************
// *** Common Functions ***
// ************************

/**
 * @param {SyntaxNodeRef} node - Node to get properties of.
 * @returns {string[]} Array of the node's props.
 */
function node_props(node: SyntaxNodeRef): string[] {
    const prop_list = node.type.props[NODE_TYPE_PROP_ID];
    if( prop_list === undefined ) {
        return [];
    }

    return prop_list.split(' ');
}

/**
 * @param {string} prop - Prop to check for.
 * @param {SyntaxNodeRef} node - Node to check.
 * @returns {boolean} If the node has the given prop.
 */
function node_has_prop(prop: string, node: SyntaxNodeRef): boolean {
    const props = node_props(node);
    return props.contains(prop);
}

/**
 * Collect nodes until the given stopping condition is met.
 * 
 * @param {SytnaxNodeRef} start_node - Node to begin at.
 * @param {(node: SyntaxNodeRef, nodes?: SyntaxNodeRef[]) => boolean} stop -
 *     Function used to determine when to stop.
 *     The function should accept a node, which ws the last added, and can
 *     optionally accept the entire array of nodes.
 *     The function should return true when collection should stop,
 *     otherwise collection will stop at the end of the current tree.
 * @returns {SyntaxNodeRef[]} Array of nodes including the start and stop node.
 */
function collect_nodes_until(
    start_node: SyntaxNodeRef,
    stop: (node: SyntaxNodeRef, nodes?: SyntaxNodeRef[]) => boolean
): SyntaxNodeRef[] {
    const nodes = [start_node];
    while( ! stop(nodes.at(-1), nodes) ) {
        const next = nodes.at(-1).node.nextSibling;
        if ( ! next ) {
            break;
        }
        nodes.push(next);
    }

    return nodes;
}

/**
 * @param {SyntaxNodeRef} node - Node to check.
 * @return {boolean} Whether the node represents the start of an internally embedded image.
 */
function node_is_embed_start(node: SyntaxNodeRef): boolean {
    const prop_id = 'formatting-link-start';
    return node_has_prop(prop_id, node);
}

/**
 * @param {SyntaxNodeRef} node - Node to check.
 * @return {boolean} Whether the node represents the end of an internally embedded image.
 */
function node_is_embed_end(node: SyntaxNodeRef): boolean {
    const prop_id = 'formatting-link-end';
    return node_has_prop(prop_id, node);
}

/**
 * @param {SyntaxNodeRef} node - Node to check.
 * @return {boolean} Whether the node represents the start of an externally embedded image.
 */
function node_is_image_start(node: SyntaxNodeRef): boolean {
    const prop_id = 'image-marker';
    return node_has_prop(prop_id, node);
}

/**
 * @param {SyntaxNodeRef} node - Node to check.
 * @return {boolean} Whether the node represents the end of an externally embedded image.
 */
function node_is_image_end(node: SyntaxNodeRef, nodes: SyntaxNodeRef[]): boolean {
    const prop_id = 'formatting-link-string';
    const is_marker = nodes.map( n => ( node_has_prop(prop_id, n) ? 1 : 0 ) );
    const num_markers = is_marker.reduce( (sum, val ) => ( sum + val ), 0 );

    return (num_markers == 2); 
}

/**
 * @param {SyntaxNodeRef} node - Node to check.
 * @return {boolean} Whether the node has alt text.
 */
function node_has_alt_text(node: SyntaxNodeRef): boolean {
    const prop_id = 'link-has-alias';
    return node_has_prop(prop_id, node);
}

/**
 * @param {SyntaxNodeRef} node - Node to check.
 * @return {boolean} Whether the node is part of the alt text.
 */
function node_is_alt_text(node: SyntaxNodeRef): boolean {
    const int_prop_id = 'link-alias';
    const ext_prop_id = 'image-alt-text';
    return (
        node_has_prop(int_prop_id, node) 
        || node_has_prop(ext_prop_id, node)
    );
}


// *******************
// *** Decorations ***
// *******************

/**
 * Widget decoration to provide the image caption.
 */
class ImageCaptionWidget extends WidgetType {
    caption: string;
    index: number;

    /**
     * @param {string} caption - Caption to display.
     */
    constructor(caption: string, index: number) {
        super();
        this.caption = caption;
        this.index = index;
    }

    eq(other: ImageCaptionWidget): boolean {
        return (
            (other.caption === this.caption)
            && (other.index === this.index)
        );
    }

    toDOM(view: EditorView): HTMLElement {
        const cap = document.createElement('figcaption')
        cap.innerHTML = this.caption;
        cap.dataset.imageCaptionIndex = this.index.toString();
        cap.addClass( ImageCaptionPlugin.caption_class );
        
        return cap;
    }

    ignoreEvent(): boolean {
        return false;
    }
}


/**
 * Mark decoration to alter the image.
 */
function createCaptionedImageMark(): Decoration {
    return Decoration.mark({
        inclusive: true,
        attributes: {
            class: 'image_with_caption'
        }
    });
}


// *******************
// *** View Plugin ***
// *******************

/**
 * @todo Should proabably be structured in a better way, perhaps by using a StateField?
 * 
 * Factory function allowing access to the plugin.
 */
export function previewImageCaptionParserFactory(plugin: ImageCaptionPlugin) {
    return class PreviewImageCaptionParser implements PluginValue {
        decorations: DecorationSet;
        state_fields: Extension[];

        constructor( view: EditorView ) {
            this.decorations = this.build_decorations(view.state);
        }

        /**
         * Create all decoration for the current editor state.
         * 
         * @param {EditorState} editor - Current editor state.
         * @returns {DecorationSet} All decorations for the current editor state.
         */
        build_decorations(state: EditorState): DecorationSet {
            const deco_builder = new RangeSetBuilder<Decoration>();

            let index = 0;
            const tree = syntaxTree(state)
            tree.iterate({
                enter: (node: SyntaxNodeRef): boolean => {
                    if ( node_is_embed_start(node) ) {
                        const nodes = collect_nodes_until(node, node_is_embed_end);
                        const has_alt_text = nodes.some(node_has_alt_text);
                        if ( ! has_alt_text ) {
                            return false;
                        }

                        // image
                        const start = nodes.at(0).from;
                        const end = nodes.at(-1).to;
                        const captioned_image_deco = createCaptionedImageMark();
                        deco_builder.add(start, start, captioned_image_deco);

                        // caption
                        const {from, to, value} = this.parse_internal_embed(
                            nodes, index, state
                        );

                        deco_builder.add(from, to, value);
                    }
                    else if ( node_is_image_start(node) ) {
                        const nodes = collect_nodes_until(node, node_is_image_end);

                        // caption
                        const {from, to, value} = this.parse_external_image(
                            nodes, index, state
                        );

                        deco_builder.add(from, to, value);
                    }
                    else {
                         // do nothing, recurse on children
                        return true;
                    }

                    index += 1;
                    return false;  // prevent recursing on children
                }
            });

            return deco_builder.finish();
        }

        update( update: ViewUpdate ) {
            if ( ! update.docChanged ) {
                return;
            }
            
            // captions
            const decos = this.build_decorations(update.state);
            this.decorations = decos;

            // fig sizes
            const imgs = document.querySelectorAll('img');
            imgs.forEach( (img: HTMLElement) => {
                const alt_text = img.getAttribute( 'alt' );
                const delimeter = plugin.settings.delimeter;
                const parsed = parseCaptionText( alt_text, delimeter );

                if( !parsed ) {
                    return;
                }

                const size = parsed.size;
                const caption = parsed.text;

                if( !size ) {
                    return;
                }

                const w = size.width.toString();
                const h = size.height.toString();
                img.setAttribute( 'width', w );
                img.setAttribute( 'height', h );
            });

        }

        destroy() {
        }

        /**
         * Parse internally embeded images.
         * 
         * @param {SyntaxNodeRef[]} nodes - List of nodes representing the embeded image.
         * @param {number} index - Figure index.
         * @param {EditorState} state - Current editor state.
         * @returns {RangeSetBuilderArgs} Arguments used for building the decoration.
         */
        parse_internal_embed(
            nodes: SyntaxNodeRef[],
            index: number,
            state: EditorState
        ): RangeSetBuilderArgs {
            const alt_nodes = nodes.filter(node_is_alt_text);
            const alt_text = state.sliceDoc( alt_nodes.at(0).from, alt_nodes.at(-1).to );

            const delimeter = plugin.settings.delimeter;
            const parsed = parseCaptionText( alt_text, delimeter );
            const size = parsed.size;
            const caption = parsed.text;
            
            const deco = Decoration.widget({
                widget: new ImageCaptionWidget(caption, index)
            });

            const im_pos = nodes.at(-1).to;
            const cap_pos = im_pos + 1;

            return {
                from: cap_pos,
                to: cap_pos,
                value: deco
            };
        }

        /**
         * Parse externally embeded images.
         * 
         * @param {SyntaxNodeRef[]} nodes - List of nodes representing the embeded image.
         * @param {number} index - Figure index.
         * @param {EditorState} state - Current editor state.
         * @returns {RangeSetBuilderArgs} Arguments used for building the decoration.
         */
        parse_external_image(
            nodes: SyntaxNodeRef[],
            index: number,
            state: EditorState
        ): RangeSetBuilderArgs{
            const alt_nodes = nodes.filter(node_is_alt_text);
            const alt_text = state.sliceDoc( alt_nodes.at(0).from, alt_nodes.at(-1).to );

            const delimeter = plugin.settings.delimeter;
            const parsed = parseCaptionText( alt_text, delimeter );
            const size = parsed.size;
            const caption = parsed.text;

            const deco = Decoration.widget({
                widget: new ImageCaptionWidget(caption, index)
            });
            
            const im_pos = nodes.at(-1).to
            const cap_pos = im_pos + 1;
            return {
                from: cap_pos,
                to: cap_pos,
                value: deco
            };
        }
    }
}


export function processPreviewImageCaption(
    plugin: ImageCaptionPlugin
): Extension {

    const view_plug = ViewPlugin.fromClass(
        previewImageCaptionParserFactory(plugin),
        {
            decorations: view_plug => view_plug.decorations
        }
    );

    return [
        view_plug
    ];
}
