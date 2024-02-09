import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, Platform, moment } from 'obsidian';
import { platform } from 'os';
let iframe: HTMLIFrameElement | null = null;
let ready: boolean = false;
// Remember to rename these classes and interfaces!
export const VIEW_TYPE_EXAMPLE = "mxmind-view";
interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		this.registerView(
			VIEW_TYPE_EXAMPLE,
			(leaf) => new ExampleView(leaf)
		);
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('network', 'Mxmind', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			//new Notice('This is a notice!');
			this.toggleView();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-sample-modal-simple',
		// 	name: 'Open sample modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });
		// This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'sample-editor-command',
		// 	name: 'Sample editor command',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection('Sample Editor Command');
		// 	}
		// });
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-sample-modal-complex',
		// 	name: 'Open sample modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	}
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.


		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				const extension = file.extension as string
				if (!extension || extension != 'md') return;
				const { vault } = this.app;

				menu.addItem((item) => {
					item
						.setTitle("Open as mindmap")
						.setIcon("document")
						.onClick(async () => {
							const leaf = await this.activateView();
							const post = async () => {
								const texts = await Promise.all(vault.getMarkdownFiles().filter(f => f == file).map((file) => vault.cachedRead(file)))
								postIframeMessage('loadFromMd', [texts[0]]);
							}
							waitEditor().then(post).catch(post);
						});
				});
			})
		);
		this.registerEvent(this.app.workspace.on("css-change", () => {
			postIframeMessage('setTheme', [getTheme()]);
		}));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	async toggleView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
			this.toggleCollapseRight();
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_EXAMPLE, active: true });
		}
		if (leaf.getViewState().active) {
			iframe?.contentWindow?.postMessage({
				method: 'fullScreen',
				params: [],
			}, '*');
		}
		// "Reveal" the leaf in case it is in a collapsed sidebar
		//workspace.revealLeaf(leaf);
	}
	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_EXAMPLE, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
		return leaf;

	}
	toggleCollapseRight() {
		const rightSplit = this.app.workspace.rightSplit;

		rightSplit.collapsed ? rightSplit.expand() : rightSplit.collapse();
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
export class ExampleView extends ItemView {
	navigation: boolean = false;
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);

	}

	getViewType() {
		return VIEW_TYPE_EXAMPLE;
	}

	getDisplayText() {
		return "Mxmind";
	}

	async onOpen() {

		const container = this.containerEl.children[1];
		container.empty();
		container.setAttribute('style', Platform.isMobile ? 'padding:0;overflow:hidden;' : 'padding:0;padding-bottom:30px;overflow:hidden;');

		container.createEl("iframe", {
			cls: "mxmind-iframe",
			attr: {
				style: 'width:100%;height:100%;',
				src: 'https://mxmind.com/mindmap/new?utm_source=obsidian&theme=' + getTheme() + '&lng=' + getLanguage(), frameborder: '0'
			}
		}, (el) => {
			iframe = el;
		});
		container.win.onmessage = (event: MessageEvent) => {
			if (event.data.event && event.data.event == 'editor-ready') {
				ready = true;
			}

		}
	}

	async onClose() {
		// Nothing to clean up.
	}
}
function waitEditor() {
	return new Promise((resolve, reject) => {
		if (ready) {
			resolve(true);
		} else {
			const t = new Date().getTime();
			const int = setInterval(() => {
				if (ready) {
					clearInterval(int);
					resolve(true);
				} else {
					if (new Date().getTime() - t > 10 * 1000) {
						clearInterval(int);
						reject(false);
					}
				}
			}, 100);
		}
	})
}
function postIframeMessage(method: string, params: Array<any>) {
	if (!iframe) return;
	iframe?.contentWindow?.postMessage({
		method,
		params
	}, '*');
}
function getTheme() {
	return document.body.hasClass("theme-dark") ? 'dark' : 'light';
}
function getLanguage() {
	const locale = moment.locale();
	const arr = locale.split('-');
	if (arr[1]) {
		arr[1] = arr[1].toString().toUpperCase();
	}
	return arr.join('-');
}