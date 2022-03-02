import {
	Plugin,
	MarkdownPostProcessor,
	MarkdownPostProcessorContext,
	MarkdownRenderChild
} from 'obsidian';

import ImageCaptionPlugin from './main';


interface ImageSize {
	width: number;
	height: number
}


/**
 * Registers a Mutation Observer on an image to add a caption.
 * The observer is unregistered after the caption has been added.
 * Meant to be used for internal embeds.
 *  
 * @param plugin {Plugin}
 * @param ctx {MarkdownPostProcessorContext}
 * @returns {MutationObserver}
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

			const parsed = parseCaptionText( caption_text, plugin.settings.delimeter );
			const size = parsed.size;
			caption_text = parsed.text;

			if ( caption_text ) {
				const caption = addCaption( mutation.target, caption_text );
				ctx.addChild( caption );
			}

			if ( size ) {
				setSize( mutation.target, size );
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
 * @param plugin {Plugin}
 * @returns {MutationObserver}
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
 * Parses text to extract the caption and size for the image.
 * 
 * @param text {string} Text to parse.
 * @param delimeter {string[]} Delimeter(s) used to indeicate caption text.
 * @returns { { caption: string, size?: ImageSize } }
 * 		An obect containing the caption text and size.
 */
function parseCaptionText( text: string, delimeter: string[] ): string | null {
	let start, end;
	let start_delim, end_delim;
	if ( delimeter.length === 0 ) {
		start_delim = '';
		end_delim = '';

		start = 0;
		end = text.length;
	}
	else if ( delimeter.length == 1 ) {
		// single delimeter character
		start_delim = delimeter[ 0 ];
		end_delim = delimeter[ 0 ];

		start = text.indexOf( start_delim );
		end = text.lastIndexOf( end_delim );
	}
	else if ( delimeter.length === 2 ) {
		// separate start and end delimeter
		start_delim = delimeter[ 0 ];
		end_delim = delimeter[ 1 ];

		start = text.indexOf( start_delim );
		end = text.lastIndexOf( end_delim );
	}
	else {
		// error
		return {
			text: undefined,
			size: undefined
		};
	}

	// caption text
	let caption, remaining_text;
	if (
		start === -1 ||
		end === -1 ||
		start === end 
	) {
		caption = undefined;
		remaining_text = [ text ];
	}
	else {
		// exclude delimeters
		const start_offset = start_delim.length;
		const end_offset = end_delim.length

		caption = text.slice( start + start_offset, end );
		remaining_text = [
			text.slice( 0, start ),
			text.slice( end + end_offset )
		];
	}

	// size
	let size = parseSize( remaining_text[ 0 ] );
	if ( ! size ) {
		size = parseSize( remaining_text[ 1 ] );
	}

	return { text: caption, size };
} 


/**
 * Searches for a size parameter of the form
 * <width>x<height> returning the parameters if found.
 * 
 * @param {string} text - Text to parse.
 * @returns {ImageSize|undefined} - Object representing the image size,
 * 		or undefined if not found.
 */
function parseSize( text: string ) {
	if ( ! text ) {
		return undefined;
	}

	const size_pattern = /(\d+)x(\d+)/i;
	const match = text.match( size_pattern );
	if ( ! match ) {
		return undefined;
	}

	return {
		width: match[ 1 ],
		height: match[ 2 ]
	};
}


/**
 * Adds a caption to an image.
 * 
 * @param {HTMLElement} target - Parent element for the caption.
 * @param {string} caption_text - Text to add for the caption.
 * @returns {MarkdownRenderChild} - Caption element that was added to the target as the caption.
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
 * Sets the width and height for an image.
 * 
 * @param {HTMLElement} target - Parent element of the image.
 * @param {ImageSize} size - Width and height values.
 */
function setSize(
	target: HTMLElement,
	size: ImageSize
) {
	const { width, height } = size;
	const img = target.querySelector( 'img' );

	target.setAttribute( 'width', width );
	target.setAttribute( 'height', height );
	img.setAttribute( 'width', width );
	img.setAttribute( 'height', height );
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
 * @param {Plugin} plugin
 * @returns {(HTMLElement, MarkdownPostProcessorContext) => void}
 * 		Function that registers internal images to have a caption added to them.
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
 * @param {Plugin} plugin
 * @returns {(HTMLElement, MarkdownPostProcessorContext) => void}
 * 		Function that registers external images to have a caption added to them.
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
				if ( caption_text ) {
					const caption = addCaption( container, caption_text );

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