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

import { StateParser, ParsedImage } from './state_parser';


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
        cap.addClass(ImageCaptionPlugin.caption_class);
        
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
        parser: StateParser;
        decorations: DecorationSet;
        state_fields: Extension[];

        constructor( view: EditorView ) {
            this.parser = new StateParser(plugin);
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
            const images = this.parser.parse(state);
            
            // imgs.forEach((img) => console.log(img.getAttribute('src')))
            for( let i = 0; i < images.length; i++ ) {
                const img = images[i];

                // // image
                // const start = img.nodes.at(0).from;
                // const end = img.nodes.at(-1).to;
                // const captioned_image_deco = createCaptionedImageMark();
                // deco_builder.add(start, end, captioned_image_deco);

                // caption
                const pos = img.nodes.at(-1).to;
                const caption_marker = Decoration.widget({
                    widget: new ImageCaptionWidget(img.caption, i)
                });

                deco_builder.add(pos, pos, caption_marker);
            }

            const live_obs = new MutationObserver(
                ( mutations: MutationRecord[], observer: MutationObserver ) => {
                    mutations.forEach((rec: MutationRecord) => {
                        if ( rec.type === 'childList' ) {
                            // console.log(mutations)
                            const imgs = rec.target.querySelectorAll('img:not(.cm-widgetBuffer)');
                            // console.log(imgs)
            
                            if ( rec.addedNodes.length ) {

                            }

                            if ( rec.removedNodes.length ) {

                            }
                        }

                    });
                }
            );

            const live_preview = document.querySelector('.markdown-source-view.is-live-preview');
            const reader_view = document.querySelector('.markdown-reading-view');
            // live_obs.observe(live_preview, { 
            //     subtree: true,
            //     childList: true,
            //     attributeFilter: [ 'class' ]
            // });



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
            // const imgs = document.querySelectorAll('img');
            // imgs.forEach( (img: HTMLElement) => {
            //     const alt_text = img.getAttribute( 'alt' );
            //     const delimeter = plugin.settings.delimeter;
            //     const parsed = parseCaptionText( alt_text, delimeter );

            //     if( !parsed ) {
            //         return;
            //     }

            //     const size = parsed.size;
            //     const caption = parsed.text;

            //     if( !size ) {
            //         return;
            //     }

            //     const w = size.width.toString();
            //     const h = size.height.toString();
            //     img.setAttribute( 'width', w );
            //     img.setAttribute( 'height', h );
            // });
        }

        destroy() {
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
