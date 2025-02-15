import {
	ItemView,
	moment,
	Platform,
	Plugin,
	WorkspaceLeaf,
	TFile,
	Menu,
} from "obsidian";

let iframe: HTMLIFrameElement | null = null;
let ready = false;
// Remember to rename these classes and interfaces!
export const VIEW_TYPE_EXAMPLE = "mxmind-view";
// interface MyPluginSettings {
// 	mySetting: string;
// }

// const DEFAULT_SETTINGS: MyPluginSettings = {
// 	mySetting: 'default'
// }
function getTheme() {
	return document.body.hasClass("theme-dark") ? "dark" : "light";
}

function getLanguage() {
	const locale = moment.locale();
	const arr = locale.split("-");
	if (arr[1]) {
		arr[1] = arr[1].toString().toUpperCase();
	}
	return arr.join("-");
}

const getUrl = () => {
	return (
		"https://mxmind.com/mindmap/new?utm_source=obsidian&utm_medium=plugin&theme=" +
		getTheme() +
		"&lng=" +
		getLanguage()
	);
};
// const reOpen=()=>{
// 	ready=false;
// 	if(iframe)iframe.src=getUrl()+'&_='+(new Date).getTime();
// }
export default class MxmindPlugin extends Plugin {
	//settings: MyPluginSettings;

	async onload() {
		//await this.loadSettings();
		this.registerView(
			VIEW_TYPE_EXAMPLE,
			(leaf) => new MxmindIframeView(leaf)
		);
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"network",
			"Mxmind",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				//new Notice('This is a notice!');
				this.toggleView();
			}
		);
		// Perform additional things with the ribbon
		//ribbonIconEl.addClass('mxmind');

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
		//this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				//@ts-ignore
				const extension = file.extension as string;
				if (!extension || extension != "md") return;
				if (!(file instanceof TFile)) return;
				//const {vault} = this.app;
				menu.addItem((item) => {
					item.setTitle(trans("Open as mindmap"))
						.setIcon("document")
						.onClick(async () => {
							ready = false; //重新赋值，不然第二次true
							//const leaf = await this.activateView();
							const content = await this.app.vault.cachedRead(
								file
							);
							//console.log(content)
							const post = async () => {
								postIframeMessage("loadFromMd", [content]);
							};
							await this.activateView();
							waitEditor().then(post).catch(post);
						});
				});
			})
		);
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				postIframeMessage("setTheme", [getTheme()]);
			})
		);
		
	}

	onunload() {}

	async toggleView() {
		const { workspace } = this.app;
		const rightSplit = this.app.workspace.rightSplit;
		if (rightSplit.collapsed) rightSplit.expand();
		// 检查是否已经有该视图打开
		const existingLeaf = workspace
			.getLeavesOfType(VIEW_TYPE_EXAMPLE)
			.first();
		if (existingLeaf) {
			workspace.revealLeaf(existingLeaf);
			this.isIframeOpen = true;
		} else {
			// 如果视图不存在，打开它
			const leaf = workspace.getRightLeaf(false); // 在右侧创建新的叶子
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_EXAMPLE,
				});
				workspace.revealLeaf(leaf);
				this.isIframeOpen = true;
			}
		}
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
		}
		await leaf.setViewState({ type: VIEW_TYPE_EXAMPLE, active: true });
		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
		return leaf;
	}

	toggleCollapseRight() {
		const rightSplit = this.app.workspace.rightSplit;

		rightSplit.collapsed ? rightSplit.expand() : rightSplit.collapse();
	}
	activeLeafPath(workspace: Workspace) {
		return workspace.activeLeaf?.view.getState().file;
	}

	activeLeafName(workspace: Workspace) {
		return workspace.activeLeaf?.getDisplayText();
	}
}

export class MxmindIframeView extends ItemView {
	navigation = true;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return VIEW_TYPE_EXAMPLE;
	}

	getDisplayText() {
		return "Mxmind";
	}
	getIcon() {
		return "network";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		const int = setInterval(() => {
			//@ts-ignore
			if (this.leaf.tabHeaderEl && this.leaf.tabHeaderEl.parentElement) {
				clearInterval(int);
				//@ts-ignore
				console.log(this.leaf.tabHeaderEl.parentElement);
				//this.leaf.tabHeaderEl.parentElement.style.display = "none";
			}
		}, 100);
		container.setAttribute(
			"style",
			Platform.isMobile
				? "padding:0;overflow:hidden;"
				: "padding:0;padding-bottom:30px;overflow:hidden;"
		);

		container.createEl(
			"iframe",
			{
				cls: "mxmind-iframe",
				attr: {
					style: "width:100%;height:100%;",
					src: getUrl(),
					frameborder: "0",
					allow: "accelerometer;gyroscope",
				},
			},
			(el) => {
				iframe = el;
			}
		);
		container.win.onmessage = async (event: MessageEvent) => {
			if (event.data.event && event.data.event == "editor-ready") {
				ready = true;
			}
			if (event.data.method == "exportDataUrl") {
				const rsp = await fetch(event.data.result);
				const item = new ClipboardItem({ "image/png": rsp.blob() });
				navigator.clipboard.write([item]);
				new Notice(trans("Image copied to the clipboard."));
			}
		};
	}

	async onClose() {
		// Nothing to clean up.
	}
	onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | string) {
		menu.addItem((item) =>
			item
				.setIcon("image-file")
				.setTitle(trans("Copy image"))
				.onClick(() => {
					iframe?.contentWindow?.postMessage(
						{
							method: "exportDataUrl",
							params: [],
						},
						"*"
					);
				})
		);
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
	});
}

function postIframeMessage(method: string, params: Array<any>) {
	if (!iframe) return;
	iframe?.contentWindow?.postMessage(
		{
			method,
			params,
		},
		"*"
	);
}
function trans(str: string) {
	const cn = {
		"Copy image": "复制图片",
		"Open as mindmap": "转为思维导图",
		"Image copied to the clipboard.": "图片已经复制到剪切板。",
	};
	if (moment.locale().includes("zh")) {
		return cn[str] || str;
	}
	return str;
}
