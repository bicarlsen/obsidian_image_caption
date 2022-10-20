import {
    SyntaxNodeRef
} from '@lezer/common';

import {
    Range,
    RangeSetBuilder,
    EditorState,
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

import ImageCaptionPlugin from './main';
import { closestSibling, addCaption, setSize } from './common';
import { StateParser, ParsedImage, EmbedType } from './state_parser';
import { ImageIndexWidget } from './index_widget';

// *******************
// *** View Plugin ***
// *******************

/**
 * @todo Should proabably be structured in a better way, perhaps by using a StateField?
 * 
 * Factory function allowing access to the plugin.
 * 
 * @returns {ImageCaptionParser} Parser class to contruct a View Plugin
 *     for CodeMirror using ViewPlugin#fromClass.
 */
export function ViewObserverFactory(plugin: ImageCaptionPlugin) {
    return class ImageCaptionParser implements PluginValue {
        parser: StateParser;
        image_info: ParsedImage[];
        observers: MutationObserver[];
        decorations: DecorationSet;

        constructor( view: EditorView ) {
            this.parser = new StateParser(plugin);
            this.observers = [];

            this.image_info = this.parser.parse(view.state);
            this.decorations = this.mark_images(this.image_info);
            this.register_observers(view, this.image_info);
        }

        /**
         * Update captions when the document state has changed.
         */
        update(update: ViewUpdate) {
            this.image_info = this.parser.parse(update.state);
            if (update.docChanged) {
                this.decorations = this.mark_images(this.image_info);
                this.register_observers(update.view, this.image_info);
            }
            else if (update.viewportChanged) {
                this.register_observers(update.view, this.image_info);
            }
        }

        destroy() {
            this.clear_observers();
        }

        /**
         * Creates image marker decorations.
         * 
         * @param {ParsedImage[]} images - List of parsed images.
         * @returns {DecorationSet} Decoration to mark images.
         */
        mark_images(images: ParsedImage[]): DecorationSet {
            const decos = [];
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                const dec = Decoration.widget( {
                    widget: new ImageIndexWidget(i, img),
                    side: 9999  // place marker as last decoration to ensure image is above, marker must be placed after image for control.
                } );

                const pos = img.nodes.at(-1).to;
                decos.push(dec.range(pos));
            }

            return Decoration.set(decos);
        }

        /**
         * Register observers for each view.
         * 
         * @param {EditorView} view - CodeMirror editor view.
         * @param {ParsedImage[]} images - Parsed images from the document.
         */
        register_observers(view: EditorView, images: ParsedImage[]) {
            const {preview, source, reading} = this.parse_views(view.root);
            if (preview) {
                this.register_preview_observers(preview, images);
            }
            if (source) {
                this.register_source_observers(source, images);
            }
            if (reading) {
                this.register_reading_observers(reading, images);
            }
        }

        /**
         * Parses the root document into its view components.
         * 
         * @param {Element} root - Root element of the document.
         * @returns {{preview: Element, source: Element, reading: Element}}
         *     Root element of each view.
         */
        parse_views(
            root: Element
        ): {preview: Element, source: Element, reading: Element} {
            const preview = root.querySelector('.markdown-source-view.is-live-preview');
            const source = root.querySelector('.markdown-source-view:not(.is-live-preview');
            const reading = root.querySelector('.markdown-reading-view');

            return {preview, source, reading};
        }

        /**
         * Register observers for the preview view.
         * 
         * @param {Element} root - Root of the preview view.
         * @param {ParsedImages[]} images - Parsed images.
         */
        register_preview_observers(root: Element, images: ParsedImage[]) {
            // clear previous captions
            const prev_caps = root.querySelectorAll(
                `.${ImageCaptionPlugin.caption_class}`
            );
            prev_caps.forEach( cap => cap.remove() );

            const markers = root.querySelectorAll('.image-caption-data');
            markers.forEach( marker => {
                const img_index = parseInt(marker.getAttribute('data-image-caption-index'));
                const info = this.image_info[img_index];
                const embed_type = info.embed_type;
                
                if (embed_type === EmbedType.Internal) {
                    const img_wrap = closestSibling(
                        marker,
                        '.internal-embed.image-embed.is-loaded',
                        -1
                    );

                    if ( ! img_wrap ) {
                        console.debug(`image container not found for mark ${img_index}`);
                        return;
                    }

                    if ( info.caption ) {
                        const cap = addCaption(img_wrap, info.caption);
                        // const fig_num = img_index.toString()
                        const fig_num = img_index + 1;
                        cap.containerEl.setAttribute('data-image-caption-fignum', fig_num.toString());
                    }

                    if ( info.size ) {
                        setSize( img_wrap, info.size );
                    }
                }
                else if (embed_type === EmbedType.External) {

                }
                else {
                    throw new Error(`Invalid embed type ${embed_type}.`);
                }
            } );


        }

        /**
         * Register observers for the source view.
         * 
         * @param {Element} root - Root of the source view.
         * @param {ParsedImages[]} images - Parsed images.
         */
        register_source_observers(root: Element, images: ParsedImage[]) {
            
        }

        /**
         * Register observers for the reading view.
         * 
         * @param {Element} root - Root of the reading view.
         * @param {ParsedImages[]} images - Parsed images.
         */
        register_reading_observers(root: Element, images: ParsedImage[]) {
            
        }

        /**
         * Removes all observers.
         */
        clear_observers() {

        }
    };
}


export function viewObserver(
    plugin: ImageCaptionPlugin
): Extension {

    const view_plug = ViewPlugin.fromClass(
        ViewObserverFactory(plugin),
        {
            decorations: v => v.decorations
        }
    );

    return [
        view_plug
    ];
}
