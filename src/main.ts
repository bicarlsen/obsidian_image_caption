import {
	App,
	Plugin,
	PluginSettingTab,
	Setting
} from 'obsidian';

import {
	captionObserver,
	processImageCaption
} from './md_processor';


interface ImageCaptionSettings {
	css: string;
	label: string;
}

const DEFAULT_SETTINGS: ImageCaptionSettings = {
	css: '',
	label: ''
}

export default class ImageCaptionPlugin extends Plugin {
	settings: ImageCaptionSettings;

	async onload() {
		await this.loadSettings();
		this.caption_tag = 'figcaption';
		this.caption_class = 'obsidian-image-caption';
		this.caption_selector = `${this.caption_tag}.${this.caption_class}`;

		this.caption_observers = [];
		this.registerMarkdownPostProcessor( processImageCaption( this ) );

		this.addStylesheet();
		this.addSettingTab( new ImageCaptionSettingTab( this.app, this ) );
	}

	onunload() {
		this.stylesheet.remove();
		this.clearObservers();
		this.removeCaptions();
	}

	async loadSettings() {
		this.settings = Object.assign( {}, DEFAULT_SETTINGS, await this.loadData() );
	}

	async saveSettings() {
		await this.saveData( this.settings );
	}

	addObserver( observer: MutationObserver ) {
		this.caption_observers.push( observer );
	}

	removeObserver( observer: MutationObserver ) {
		observer.disconnect();
		const index = this.caption_observers.indexOf( observer );
		this.caption_observers.splice( index, 1 );
	}

	clearObservers() {
		for ( const observer of this.caption_observers ) {
			observer.disconnect();
		}

		this.caption_observers = [];
	}

	addStylesheet() {
		this.stylesheet = document.createElement( 'style' );
		this.stylesheet.setAttribute( 'type', 'text/css' );
		this.updateStylesheet();
		document.head.append( this.stylesheet );
	}

	updateStylesheet() {
		const css = this.settings.css ? `${this.caption_selector} { ${this.settings.css} }` : '';

		let label = this.settings.label;
		if ( label ) {
			const number_pattern = /(?<!\\)#/g;
			label = label.replace( number_pattern, "' attr(data-image-caption-index) '" );  // inner quotes used to kill string and insert attr. + between strings breaks it.
			label = label.replace( '\\#', '#' );
			label = `${this.caption_selector}::before { content: '${label} ' }`;  // additional space in content intentional
		}

		this.stylesheet.innerText = `${css} ${label}`;
	}

	removeCaptions() {
		for ( const caption of document.querySelectorAll( this.caption_selector ) ) {
			caption.remove();
		}
	}
}  // end ImageCaptionPlugin


class ImageCaptionSettingTab extends PluginSettingTab {
	plugin: ImageCaptionPlugin;

	constructor( app: App, plugin: ImageCaptionPlugin ) {
		super( app, plugin );
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		containerEl.empty();

		new Setting( containerEl )
			.setName( 'Label' )
			.setDesc( 'Prepend this text before each caption.' )
			.addText( ( text ) => text
				.setPlaceholder( 'Label' )
				.setValue( this.plugin.settings.label )
				.onChange( async ( value ) => {
					this.plugin.settings.label = value;
					await this.plugin.saveSettings();
					this.plugin.updateStylesheet();
				} )
			);

		new Setting( containerEl )
			.setName( 'CSS' )
			.setDesc( 'Custom CSS styling for captions.' )
			.addTextArea( ( text ) => text
				.setPlaceholder('Enter your CSS' )
				.setValue( this.plugin.settings.css )
				.onChange( async ( value ) => {
					this.plugin.settings.css = value.trim();
					await this.plugin.saveSettings();
					this.plugin.updateStylesheet();
				} )
			);
	}
}
