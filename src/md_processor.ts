import {
	Plugin,
	MarkdownPostProcessor,
	MarkdownPostProcessorContext,
	MarkdownRenderChild
} from 'obsidian';

import ImageCaptionPlugin from './main';


export function captionObserver( plugin: Plugin ) {

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
				addCaption( mutation.target, caption_text );
			}
		}  // end for..of

		updateFigureIndices();
		plugin.removeObserver( observer );

	} );
}

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

	const start_offset = delimeter[ 0 ].length; // exclude starting delimeter
	return text.slice( start + start_offset, end );
} 

function addCaption(
	target: HTMLElement,
	caption_text: string
): HTMLElement {
	const caption = document.createElement( ImageCaptionPlugin.caption_tag );
	caption.addClass( ImageCaptionPlugin.caption_class );
	caption.innerText = caption_text;
	target.appendChild( caption );

	return caption;
}


function updateFigureIndices() {
	document.querySelectorAll( 'div.workspace-leaf' ).forEach(
		( container : HTMLElement ) => {
			let index = 1;
			container.querySelectorAll( ImageCaptionPlugin.caption_selector ).forEach(
				( el: HTMLElement ) => {
					el.dataset.imageCaptionIndex = index;
					index += 1;
				}
			);
		}
	);
}


export function processImageCaption(
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
				const observer = captionObserver( plugin );
				observer.observe(
					container,
					{ attributes: true, attributesFilter: [ 'class' ] }
				);

				plugin.addObserver( observer );
			}
		);
	};
}