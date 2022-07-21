import {
	App,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting
} from 'obsidian';

import {
	processInternalImageCaption,
	processExternalImageCaption,
} from './md_processor';

import { processPreviewImageCaption } from './preview_processor';

interface ImageCaptionSettings {
	css: string;
	label: string;
	delimeter: string[];
    htmlCaption: boolean;
}

const DEFAULT_SETTINGS: ImageCaptionSettings = {
	css: '',
	label: '',
	delimeter: [],
    htmlCaption: false,
}


export default class ImageCaptionPlugin extends Plugin {
	settings: ImageCaptionSettings;
    caption_observers: MutationObserver[];
    stylesheet: HTMLElement; 

	static caption_tag: string = 'figcaption';
	static caption_class: string = 'obsidian-image-caption';
	static caption_selector: string = `${ImageCaptionPlugin.caption_tag}.${ImageCaptionPlugin.caption_class}`;
    

	async onload() {
		await this.loadSettings();

        // register processors for preview mode
        const previewProcessor = processPreviewImageCaption( this );
        this.registerEditorExtension( previewProcessor );

        // register processors for read mode
		this.caption_observers = [];
		this.registerMarkdownPostProcessor( processInternalImageCaption( this ) );
		this.registerMarkdownPostProcessor( processExternalImageCaption( this ) );

		this.addStylesheet();
		this.addSettingTab( new ImageCaptionSettingTab( this.app, this ) );
	}

	onunload() {
		if ( this.stylesheet ) {
            this.stylesheet.remove();
        }

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
		const css = this.settings.css ? `${ImageCaptionPlugin.caption_selector} { ${this.settings.css} }` : '';

		let label = this.settings.label;
		if ( label ) {
			// replace all unescaped hashtags with image index
			const number_pattern = /(^|[^\\])#/g;
			label = label.replace( number_pattern, "$1' attr(data-image-caption-index) '" );  // inner quotes used to kill string and insert attr. + between strings breaks it.
			
			// Replace escaped hashtags with hashtags
			label = label.replace( '\\#', '#' );

			label = `${ImageCaptionPlugin.caption_selector}::before { content: '${label} ' }`;  // additional space in content intentional
		}

		this.stylesheet.innerText = `${css} ${label}`;
	}

	removeCaptions() {
        const captions: NodeList = document.querySelectorAll( ImageCaptionPlugin.caption_selector )
		captions.forEach( ( caption: HTMLElement ) => {
			caption.remove();
		} );
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

		// label
		new Setting( containerEl )
			.setName( 'Label' )
			.setDesc( 'Prepend this text before each caption.' )
			.addText( ( text ) => text
				.setPlaceholder( 'Label' )
				.setValue( this.plugin.settings.label )
				.onChange( async ( value ) => {
					this.plugin.settings.label = value.trim();
					await this.plugin.saveSettings();
					this.plugin.updateStylesheet();
				} )
			);

		// css
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

		// delimeter
		const delimeter = new Setting( containerEl )
			.setName( 'Delimeter' )
			.setDesc(
				'Identify the caption by surrounding it with the delimeter. ' +
				'Start and end delimeters mays be specified by separation with a comma (,).'
			)
			.setTooltip(
				'If no delimeter is provided the entire alt text is taken to be the caption. ' +
				'If a single delimeter is specified it must indicate the start and end of the caption. ' +
				'If two delimeters are specified, by separation with a comma, the caption is taken to be ' +
				'the text between the start and end delimeters.'
			);

		delimeter.addText( ( text ) => text
			.setPlaceholder( 'Delimeter' )
			.setValue( this.plugin.settings.delimeter.join( ', ' ) )
			.onChange( async ( value ) => {
				let delimeters = value.split( ',' ).map( d => d.trim() );

				// validate setting
				if ( delimeters.length > 2 ) {
					// too many delimeters
					delimeter.controlEl.addClass( 'setting-error' );
					return;
				}

				if ( delimeters.length === 2 && delimeters.some( d => !d ) ) {
					// empty delimeter
					delimeter.controlEl.addClass( 'setting-error' );
					return;
				}

				// delimeters valid
				if ( delimeters.length === 1 && delimeters[ 0 ] === '' ) {
					// no delimeter specified
					delimeters = [];
				}

				delimeter.controlEl.removeClass( 'setting-error' );
				this.plugin.settings.delimeter = delimeters;
				await this.plugin.saveSettings();
			} )
		);

		// parse html
		new Setting( containerEl )
			.setName( 'Caption as HTML' )
			.setDesc( 'Insert caption text as HTML.' )
			.addToggle( ( toggle ) => toggle
				.setValue( this.plugin.settings.htmlCaption )
				.onChange( async ( value ) => {
					this.plugin.settings.htmlCaption = value;
					await this.plugin.saveSettings();
				} )
			);

	}  // end #display
}
