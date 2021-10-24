import {
	MarkdownPostProcessor,
	MarkdownPostProcessorContext,
	MarkdownRenderChild
} from 'obsidian';


const classListener = new MutationObserver( ( mutations ) => {
	mutations.forEach( ( mutation ) => {
		if ( !mutation.target.matches( 'span.image-embed' ) ) {
			return;
		}

		const caption_text = mutation.target.getAttribute( 'alt' );
		if ( caption_text === mutation.target.getAttribute( 'src' ) ) {
			// not user defined
			return;
		}

		if ( mutation.target.querySelector( 'figcaption.obsidian-image-caption' ) ) {
			// caption already added
			return;
		}

		addCaption( mutation.target, caption_text );

	} );  // end forEach
} );


function addCaption( target: HTMLElement, caption_text: string ): HTMLElement {
	const caption = document.createElement( 'figcaption' );
	caption.addClass( 'obsidian-image-caption' );
	caption.innerText = caption_text;
	target.appendChild( caption );

	return caption;
}


export default function processImageCaption (
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): void {

	el.querySelectorAll( 'span.internal-embed' ).forEach(
		( container: HTMLElement ) => {
			// must listen for class changes because images
			// may be loaded after this run
			classListener.observe(
				container,
				{ attributes: true, attributesFilter: [ 'class' ] }
			);
		}
	);
}