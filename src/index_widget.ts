import {
	EditorView,
	WidgetType
} from '@codemirror/view';

import { ParsedImage } from './state_parser';


export class ImageIndexWidget extends WidgetType {
	index: number;
	info: ParsedImage;

	constructor(index: number, info: ParsedImage) {
		super();

		this.index = index;
		this.info = info;
	}

	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement('data');
		container.addClass('image-caption-data')
		container.setAttribute('data-image-caption-index', this.index.toString());

		return container;
	}

	eq(other: ImageIndexWidget): boolean {
		return (
			(other.index === this.index)
			&& (other.info.embed_type === this.info.embed_type)
		);
	}
}
