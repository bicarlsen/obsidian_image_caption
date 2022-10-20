import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild
} from 'obsidian';

import ImageCaptionPlugin from './main';
import {
    parseCaptionText,
    addCaption,
    setSize,
    updateFigureIndices
} from './common';

/**
 * Registers a Mutation Observer on an image to add a caption.
 * The observer is unregistered after the caption has been added.
 * Meant to be used for internal embeds.
 *  
 * @param plugin {ImageCaptionPlugin}
 * @param ctx {MarkdownPostProcessorContext}
 * @returns {MutationObserver}
 */
export function internalCaptionObserver(
	plugin: ImageCaptionPlugin,
	ctx: MarkdownPostProcessorContext
): MutationObserver {
	return new MutationObserver( ( mutations: MutationRecord[], observer: MutationObserver ) => {
		for ( const mutation of mutations ) {
            const target = mutation.target as HTMLElement;
			if ( !target.matches( 'span.image-embed' ) ) {
				continue;
			}

			let caption_text = target.getAttribute( 'alt' );
			if ( caption_text === target.getAttribute( 'src' ) ) {
				// default caption, skip
				continue;
			}

			if ( target.querySelector( ImageCaptionPlugin.caption_selector ) ) {
				// caption already added
				continue;
			}

            if ( ! caption_text ) {
                continue;
            }
			
            const parsed = parseCaptionText( caption_text, plugin.settings.delimeter );
			const size = parsed.size;
			caption_text = parsed.text;

			if ( caption_text ) {
				const caption = addCaption(
					target,
					caption_text,
					plugin.settings.htmlCaption
				);
				ctx.addChild( caption );

                target.addClass( 'with_image_caption' );
			}

			if ( size ) {
				setSize( target, size );
			}
		}  // end for..of

		updateFigureIndices();
		plugin.removeObserver( observer );
	} );
}


/**
 * Registers a Mutation Observer on an image to add a caption.
 * The observer is unregistered after the caption has been added.
 * Meant to be used for external embeds.
 *  
 * @param plugin {ImageCaptionPlugin}
 * @returns {MutationObserver}
 */
export function externalCaptionObserver(
	plugin: ImageCaptionPlugin
): MutationObserver {
	return new MutationObserver( ( mutations, observer ) => {
		let update = false;
		for ( const mutation of mutations ) {
			const captions = [ ...mutation.addedNodes ].filter(
				( elm: HTMLElement ) => {
					return elm.matches(ImageCaptionPlugin.caption_selector);
				}
			);

			if ( captions.length ) {
				// new caption exists
				update = true;
			}
		}

		if (update) {
			updateFigureIndices();
			plugin.removeObserver(observer);
		}
	} );
}


/**
 * Registers MutationObservers on internal images.
 * 
 * @param {ImageCaptionPlugin} plugin
 * @returns {(HTMLElement, MarkdownPostProcessorContext) => void}
 * 		Function that registers internal images to have a caption added to them.
 */
export function processInternalImageCaption(
	plugin: ImageCaptionPlugin
): ( el: HTMLElement, ctx: MarkdownPostProcessorContext ) => void {

	return function (
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): void {
		console.log(el)
		el.querySelectorAll( 'span.internal-embed.image-embed' ).forEach(
			( container: HTMLElement ) => {
				// must listen for class changes because images
				// may be loaded after this run
				const observer = internalCaptionObserver( plugin, ctx );
				observer.observe(
					container,
					{ attributes: true, attributeFilter: [ 'class' ] }
				);

				plugin.addObserver( observer );
			}
		);
	};
}


/**
 * Adds caption to external images.
 * 
 * @param {ImageCaptionPlugin} plugin
 * @returns {(HTMLElement, MarkdownPostProcessorContext) => void}
 * 		Function that registers external images to have a caption added to them.
 */
export function processExternalImageCaption(
	plugin: ImageCaptionPlugin
): ( el: HTMLElement, ctx: MarkdownPostProcessorContext ) => void {

	return function (
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): void {
		const container_css_class = 'obsidian-image-caption-external-embed';

		const elms = el.querySelectorAll( 'img' );
		elms.forEach(
			( elm: HTMLElement ) => {
				if( elm.closest( 'span.internal-embed' ) ) {
					// filter out internal images
					return;
				}

				const img = elm;
				if (img.closest(`.${container_css_class}`)) {
					// caption already added
					return;
				}

				// @todo: External images no longer have alt text.
				// 		Need to find another way to add caption.
				let caption_text = img.getAttribute( 'alt' );
                if ( ! caption_text ) {
                    return;
                }

				const parsed = parseCaptionText(
					caption_text,
					plugin.settings.delimeter
				);
				
				const size = parsed.size;
				caption_text = parsed.text;
				if ( !( caption_text || size ) ) {
					return;
				}

				// create container
				const container = document.createElement( 'span' );
				container.addClass( container_css_class );

				// observe container for caption to be added
				const observer = externalCaptionObserver( plugin );
				observer.observe(
					container,
					{ childList: true }
				);

				plugin.addObserver( observer );

				// insert container into DOM
				img.replaceWith( container );
				container.appendChild( img );

				// add caption
				if ( caption_text ) {
					const caption = addCaption(
						container,
						caption_text,
						plugin.settings.htmlCaption
					);

					ctx.addChild( new MarkdownRenderChild( container ) );
					ctx.addChild( caption );
				}

				// set size
				if ( size ) {
					setSize( container, size );
				}
			}
		);
	};
}
