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

		this.caption_observer = captionObserver();
		this.registerMarkdownPostProcessor( processImageCaption( this.caption_observer ) );

		this.addStylesheet();
		this.addSettingTab( new ImageCaptionSettingTab( this.app, this ) );
	}

	onunload() {
		this.caption_observer.disconnect();
	}

	async loadSettings() {
		this.settings = Object.assign( {}, DEFAULT_SETTINGS, await this.loadData() );
	}

	async saveSettings() {
		await this.saveData( this.settings );
	}

	addStylesheet() {
		this.stylesheet = document.createElement( 'style' );
		this.updateStylesheet();
		document.head.append( this.stylesheet );
	}

	updateStylesheet() {
		const base = 'figcaption.obsidian-image-caption';
		const css = this.settings.css ? `${base} { ${this.settings.css} }` : '';

		let label = this.settings.label;
		if ( label ) {
			const number_pattern = /(?<!\\)#/;
			label = label.replace( number_pattern, "' attr(data-image_caption_index) '" );  // inner quotes used to kill string and insert attr. + between strings breaks it.
			label = label ? `${base}::before { content: '${label} ' }` : '';  // additional space intentional
		}

		this.stylesheet.innerText = `${css} ${label}`;
	}
}


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
			.setDesc( 'Prepend this text before each captioned image.' )
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
			.setDesc( 'Custom css styling' )
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
