import {
	MarkdownPostProcessor,
	MarkdownPostProcessorContext,
	MarkdownRenderChild
} from 'obsidian';


export function captionObserver() {

	return new MutationObserver( ( mutations ) => {
		mutations.forEach( ( mutation ) => {
			if ( !mutation.target.matches( 'span.image-embed' ) ) {
				return;
			}

			const caption_text = mutation.target.getAttribute( 'alt' );
			if ( caption_text === mutation.target.getAttribute( 'src' ) ) {
				// default caption, skip
				return;
			}

			if ( mutation.target.querySelector( 'figcaption.obsidian-image-caption' ) ) {
				// caption already added
				return;
			}

			addCaption( mutation.target, caption_text );
			updateFigureIndices();
		} );  // end forEach
	} );
}


function addCaption(
	target: HTMLElement,
	caption_text: string,
): HTMLElement {
	const caption = document.createElement( 'figcaption' );
	caption.addClass( 'obsidian-image-caption' );
	caption.innerText = caption_text;
	target.appendChild( caption );

	return caption;
}


function updateFigureIndices() {
	document.querySelectorAll( 'div.workspace-leaf' ).forEach(
		( container : HTMLElement ) => {
			let index = 1;
			container.querySelectorAll( 'figcaption.obsidian-image-caption' ).forEach(
				( el: HTMLElement ) => {
					el.dataset.image_caption_index = index;
					index += 1;
				}
			);
		}
	);
}


export function processImageCaption(
	observer: MutationObserver
): ( el: HTMLElement, ctx: MarkdownPostProcessorContext ) => void {

	return function (
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): void {

		el.querySelectorAll( 'span.internal-embed' ).forEach(
			( container: HTMLElement ) => {
				// must listen for class changes because images
				// may be loaded after this run
				observer.observe(
					container,
					{ attributes: true, attributesFilter: [ 'class' ] }
				);
			}
		);
	};
}