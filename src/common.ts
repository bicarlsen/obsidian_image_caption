import {
	MarkdownRenderChild
} from 'obsidian';

import ImageCaptionPlugin from './main';


interface ImageSize {
	width: number;
	height: number;
}



/**
 * Parses text to extract the caption and size for the image.
 * 
 * @param text {string} Text to parse.
 * @param delimeter {string[]} Delimeter(s) used to indeicate caption text.
 * @returns { { caption: string, size?: ImageSize } }
 * 		An obect containing the caption text and size.
 */
export function parseCaptionText( text: string, delimeter: string[] ): {text: string, size?: ImageSize} | null {
    if ( ! text ) {
        return null;
    }
	
    let start, end;
	let start_delim, end_delim;
	if ( delimeter.length === 0 ) {
		start_delim = '';
		end_delim = '';

		start = 0;
		end = text.length;
	}
	else if ( delimeter.length === 1 ) {
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
export function parseSize( text: string ): ImageSize {
	if ( ! text ) {
		return undefined;
	}

	const size_pattern = /(\d+|auto)x(\d+|auto)/i;
	const match = text.match( size_pattern );
	if ( ! match ) {
		return undefined;
	}

    let width = parseInt(match[1]);
    let height = parseInt(match[2]);
	return { width, height };
}


/**
 * Adds a caption to an image.
 * 
 * @param {HTMLElement} target - Parent element for the caption.
 * @param {string} caption_text - Text to add for the caption.
 * @param {boolean} [asHtml=false] - Insert caption text as HTML rather than text.
 * @returns {MarkdownRenderChild} - Caption element that was added to the target as the caption.
 */
export function addCaption(
	target: HTMLElement,
	caption_text: string,
	asHtml: boolean = false
): MarkdownRenderChild {
	const caption = document.createElement( ImageCaptionPlugin.caption_tag );
	caption.addClass( ImageCaptionPlugin.caption_class );
	if ( asHtml ) {
		caption.innerHTML = caption_text;
	}
	else{
		caption.innerText = caption_text;
	}

	target.appendChild( caption );

	return new MarkdownRenderChild( caption );
}


/**
 * Sets the width and height for an image.
 * 
 * @param {HTMLElement} target - Parent element of the image.
 * @param {ImageSize} size - Width and height values.
 */
export function setSize(
	target: HTMLElement,
	size: ImageSize
) {
    const img = target.querySelector( 'img' );
	const { width, height } = size;
    const w = width.toString();
    const h = height.toString();

	target.setAttribute( 'width', w );
	target.setAttribute( 'height', h );
	img.setAttribute( 'width', w );
	img.setAttribute( 'height', h );
}


/**
 * Updates index data for images.
 */
export function updateFigureIndices() {
	document.querySelectorAll( 'div.workspace-leaf' ).forEach(
		( workspace: HTMLElement ) => {
			let index = 1;
			workspace.querySelectorAll( ImageCaptionPlugin.caption_selector ).forEach(
				( el: HTMLElement ) => {
					el.dataset.imageCaptionIndex = index.toString();
					index += 1;
				}
			);
		}
	);
}

