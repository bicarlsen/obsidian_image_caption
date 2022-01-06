import {
	Plugin,
	MarkdownPostProcessor,
	MarkdownPostProcessorContext,
	MarkdownRenderChild
} from 'obsidian';

import ImageCaptionPlugin from './main';


/**
 * Registers a Mutation Observer on an image to add a caption.
 * The observer is unregistered after the caption has been added.
 * Meant to be used for internal embeds.
 *  
 * @param plugin [Plugin]
 * @param ctx [MarkdownPostProcessorContext]
 * @returns [MutationObserver]
 */
export function internalCaptionObserver(
	plugin: Plugin,
	ctx: MarkdownPostProcessorContext
) {
	return new MutationObserver( ( mutations, observer ) => {
		for ( const mutation of mutations ) {
			if ( !mutation.target.matches( 'span.image-embed' ) ) {
				continue;
			}

			let caption_text = mutation.target.getAttribute( 'alt' );
			if ( caption_text === mutation.target.getAttribute( 'src' ) ) {
				// default caption, skip
				continue;
			}

			if ( mutation.target.querySelector( ImageCaptionPlugin.caption_selector ) ) {
				// caption already added
				continue;
			}

			caption_text = parseCaptionText( caption_text, plugin.settings.delimeter );
			if ( caption_text !== null ) {
				const caption = addCaption( mutation.target, caption_text );
				ctx.addChild( caption );
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
 * @param plugin [Plugin]
 * @returns [MutationObserver]
 */
export function externalCaptionObserver(
	plugin: Plugin
) {
	return new MutationObserver( ( mutations, observer ) => {
		let update = false;
		for ( const mutation of mutations ) {
			const captions = [ ...mutation.addedNodes ].filter(
				( elm: HTMLElement ) => {
					return elm.matches( ImageCaptionPlugin.caption_selector )
				}
			);

			if ( captions.length ) {
				// new caption exists
				update = true;
			}
		}

		if ( update ) {
			updateFigureIndices();
			plugin.removeObserver( observer );
		}
	} );
}


/**
 * Parses text to extract the caption.
 * 
 * @param text [string] Text to parse.
 * @param delimeter [string[]] Delimeter(s) used to indeicate caption text.
 * @returns [string] Caption text.
 */
function parseCaptionText( text: string, delimeter: string[] ): string | null {
	if ( delimeter.length === 0 ) {
		return text;
	}
	
	let start, end;
	if ( delimeter.length == 1 ) {
		// single delimeter character
		delimeter = delimeter[ 0 ];
		start = text.indexOf( delimeter );
		end = text.lastIndexOf( delimeter );
	}
	else if ( delimeter.length === 2 ) {
		// separate start and end delimeter
		start = text.indexOf( delimeter[ 0 ] );
		end = text.lastIndexOf( delimeter[ 1 ] );
	}
	else {
		// error
		return null;
	}

	if ( start === -1 || end === -1 ) {
		return null;
	}
	if ( start === end ) {
		return '';
	}

	const start_offset = delimeter[ 0 ].length;  // exclude starting delimeter
	return text.slice( start + start_offset, end );
} 


/**
 * Adds a caption to an image.
 * 
 * @param target [HTMLElement] Parent element for the caption.
 * @param caption_text [string] Text to add for the caption.
 * @returns [MarkdownRenderChild] Caption element that was added to the target as the caption.
 */
function addCaption(
	target: HTMLElement,
	caption_text: string
): MarkdownRenderChild {
	const caption = document.createElement( ImageCaptionPlugin.caption_tag );
	caption.addClass( ImageCaptionPlugin.caption_class );
	caption.innerText = caption_text;
	target.appendChild( caption );

	return new MarkdownRenderChild( caption );
}


/**
 * Updates index data for images.
 */
function updateFigureIndices() {
	document.querySelectorAll( 'div.workspace-leaf' ).forEach(
		( workspace: HTMLElement ) => {
			let index = 1;
			workspace.querySelectorAll( ImageCaptionPlugin.caption_selector ).forEach(
				( el: HTMLElement ) => {
					el.dataset.imageCaptionIndex = index;
					index += 1;
				}
			);
		}
	);
}


/**
 * Registers MutationObservers on internal images.
 * 
 * @param plugin [Plugin]
 * @returns [(HTMLElement, MarkdownPostProcessorContext) => void] Function that registers internal images to have a caption added to them.
 */
export function processInternalImageCaption(
	plugin: Plugin
): ( el: HTMLElement, ctx: MarkdownPostProcessorContext ) => void {

	return function (
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): void {
		el.querySelectorAll( 'span.internal-embed' ).forEach(
			( container: HTMLElement ) => {
				// must listen for class changes because images
				// may be loaded after this run
				const observer = internalCaptionObserver( plugin, ctx );
				observer.observe(
					container,
					{ attributes: true, attributesFilter: [ 'class' ] }
				);

				plugin.addObserver( observer );
			}
		);
	};
}


/**
 * Adds caption to external images.
 * 
 * @param plugin [Plugin]
 * @returns [(HTMLElement, MarkdownPostProcessorContext) => void] Function that registers external images to have a caption added to them.
 */
export function processExternalImageCaption(
	plugin: Plugin
): ( el: HTMLElement, ctx: MarkdownPostProcessorContext ) => void {

	return function (
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): void {
		const container_css_class = 'obsidian-image-caption-external-embed';

		elms = [ ...el.querySelectorAll( 'img' ) ];
		elms.filter( ( elm: HTMLElement ) => {
			// filter out internal images
			return ! elm.closest( 'span.internal-embed' );
		} ).forEach(
			( img: HTMLElement ) => {
				if ( img.closest( `.${container_css_class}` ) ) {
					// caption already added
					return;
				}

				let caption_text = img.getAttribute( 'alt' );
				caption_text = parseCaptionText( caption_text, plugin.settings.delimeter );
				if ( caption_text === null ) {
					// empty caption
					return;
				}

				// create container
				// const parent = img.parentNode;
				const container = document.createElement( 'span' );
				container.addClass( container_css_class );

				// observe container for caption to be added
				const observer = externalCaptionObserver( plugin, ctx );
				observer.observe(
					container,
					{ childList: true }
				);

				plugin.addObserver( observer );

				// insert container into DOM
				img.replaceWith( container );
				container.appendChild( img );

				// add caption
				const caption = addCaption( container, caption_text );

				ctx.addChild( new MarkdownRenderChild( container ) );
				ctx.addChild( caption );
				// setTimeout(	updateFigureIndices, 5 );
			}
		);
	};
}