import {
	App,
	Plugin,
	PluginSettingTab,
	Setting
} from 'obsidian';

import processImageCaption from './md_processor';


interface ImageCaptionSettings {
}

const DEFAULT_SETTINGS: ImageCaptionSettings = {
}

export default class ImageCaptionPlugin extends Plugin {
	settings: ImageCaptionSettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownPostProcessor( processImageCaption );

		// this.addSettingTab( new ImageCaptionSettingTab( this.app, this ) );

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign( {}, DEFAULT_SETTINGS, await this.loadData() );
	}

	async saveSettings() {
		await this.saveData( this.settings );
	}
}


class ImageCaptionSettingTab extends PluginSettingTab {
	plugin: ImageCaptionPlugin;

	constructor( app: App, plugin: ImageCaptionPlugin ) {
		super( app, plugin );
		this.plugin = plugin;
	}

	display(): void {
		// let { containerEl } = this;

		// containerEl.empty();

		// containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		// new Setting(containerEl)
		// 	.setName('Setting #1')
		// 	.setDesc('It\'s a secret')
		// 	.addText(text => text
		// 		.setPlaceholder('Enter your secret')
		// 		.setValue(this.plugin.settings.mySetting)
		// 		.onChange(async (value) => {
		// 			console.log('Secret: ' + value);
		// 			this.plugin.settings.mySetting = value;
		// 			await this.plugin.saveSettings();
		// 		}));
	}
}
