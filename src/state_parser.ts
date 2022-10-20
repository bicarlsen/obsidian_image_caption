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
    ImageSize,
    ParsedCaption,
    parseCaptionText,
    addCaption,
    setSize,
    updateFigureIndices,
} from './common';


// *******************
// *** Definitions ***
// *******************

/**
 * Holds information about a parsed image.
 * 
 * + nodes: List of nodes representing the entire image.
 * + src: Image source URI
 * + caption: Image caption, if it exists
 * + size: A size object of {width: number, height: number} of the desired dimensions,
 *         if it exists.
 * + embed_type: String indicating the type of embed.
 *     Values are ['internal', 'external']
 */
export interface ParsedImage {
    nodes: SyntaxNodeRef[];
    src: string;
    caption?: string;
    size?: ImageSize;
    embed_type: EmbedType;
}

/**
 * Type of embed.
 */
export enum EmbedType {
    Internal = 'internal',
    External = 'external',
}

/**
 * Id of the `node.type.props` storing relevant information.
 */
const NODE_TYPE_PROP_ID = 11;


// ************************
// *** Common Functions ***
// ************************

/**
 * @param {SyntaxNodeRef[]} nodes - List of nodes to extract text between.
 * @param {EditorState} state - Editor state containing the DOM.
 * @returns {string} Text between the first and last nodes.
 */
function nodes_text(nodes: SyntaxNodeRef[], state: EditorState): string {
    return state.doc.slice(
        nodes.at(0).from,
        nodes.at(-1).to
    ).toString();
}

/**
 * @param {SyntaxNodeRef} node - Node to get properties of.
 * @returns {string[]} Array of the node's props.
 */
function node_props(node: SyntaxNodeRef): string[] {
    const props = node.type ? node.type.props : node.props;
    const prop_list = props[NODE_TYPE_PROP_ID];
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

/**
 * @param {SyntaxNodeRef} node - Node to check.
 * @return {boolean} Whether the node contains the source of an internally embedded image.
 */
function node_is_embed_src(node: SyntaxNodeRef): boolean {
    const prop_id = 'hmd-internal-link';
    return node_has_prop(prop_id, node);
}

/**
 * @param {SyntaxNodeRef} node - Node to check.
 * @return {boolean} Whether the node contains the source of an externally embeded image.
 */
function node_is_image_src(node: SyntaxNodeRef): boolean {
    const prop_id = 'url';
    return node_has_prop(prop_id, node);
}


// **************
// *** Parser ***
// **************


export class StateParser {
    plugin:  ImageCaptionPlugin;

    /**
     * @param {ImageCaptionPlugin} plugin - Plugin instance to use for parsing settings.
     */
    constructor(plugin: ImageCaptionPlugin) {
        this.plugin = plugin;
    }

    /**
     * Parses an editor state returning a list of parsed images.
     * 
     * @param {EditorState} state: Editor state to parse.
     * @returns {ParsedImage[]} List of parsed images.
     */
    parse(state: EditorState): ParsedImage[] {
        const tree = syntaxTree(state);
        const images: ParsedImage[] = [];
        let embed_type: EmbedType;

        tree.iterate({
            enter: (node: SyntaxNodeRef): boolean => {
                let nodes;
                if ( node_is_embed_start(node) ) {
                    console.debug(node);
                    nodes = collect_nodes_until(node, node_is_embed_end);
                    embed_type = EmbedType.Internal;
                }
                else if ( node_is_image_start(node) ) {
                    nodes = collect_nodes_until(node, node_is_image_end);
                    embed_type = EmbedType.External;
                }
                else {
                    // not an image, do nothing, recurse on children
                    return true;
                }

                const src = this.parse_nodes_src( nodes, state );
                let caption_info = this.parse_nodes_caption( nodes, state );
                if ( ! caption_info ) {
                    caption_info = {
                        text: undefined,
                        size: undefined
                    };
                }

                const image: ParsedImage = {
                    nodes,
                    src,
                    caption: caption_info.text,
                    size: caption_info.size,
                    embed_type
                };

                images.push(image);
                return false;  // prevent recursing on children
            }
        });

        return images;
    }

    /**
     * Parse caption from nodes.
     * 
     * @param {SyntaxNodeRef[]} nodes - List of nodes representing the image.
     * @param {EditorState} state - Current editor state.
     * @returns {string} Image's source URI.
     * @throws {Error} If the nodes' source could not be determined.
     */
    parse_nodes_src(
        nodes: SyntaxNodeRef[],
        state: EditorState
    ): string {
        let src_nodes;
        src_nodes = nodes.filter(node_is_embed_src);
        if ( src_nodes.length ) {
            // internal embed
            const src_text = nodes_text(src_nodes, state);
            const src_parts = src_text.split('|').map(
                (pt: string) => {
                    return pt.trim();
                }
            );

            return src_parts[0];
        }

        src_nodes = nodes.filter(node_is_image_src);
        if ( !src_nodes.length ) {
            throw Error('Could not find source for nodes.');
        }

        // external embed
        let src_text = nodes_text(src_nodes, state).trim();

        // strip beginning and end
        src_text = src_text.slice(1, -1);
        return src_text;        
    }


    /**
     * Parse caption from nodes.
     * 
     * @param {SyntaxNodeRef[]} nodes - List of nodes representing the image.
     * @param {EditorState} state - Current editor state.
     * @returns {ParsedCaption | null} Parsed caption information or null if none exists.
     */
    parse_nodes_caption(
        nodes: SyntaxNodeRef[],
        state: EditorState
    ): ParsedCaption | null {
        const alt_nodes = nodes.filter(node_is_alt_text);
        if ( ! alt_nodes.length ) {
            return null;
        }

        const alt_text = state.sliceDoc( alt_nodes.at(0).from, alt_nodes.at(-1).to );
        const delimeter = this.plugin.settings.delimeter;
        return parseCaptionText( alt_text, delimeter );
    }
}
