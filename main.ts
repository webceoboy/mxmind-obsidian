import {
	ItemView,
	moment,
	Platform,
	Plugin,
	WorkspaceLeaf,
	TFile,
	Menu,
	MarkdownView,
	Notice,
	TAbstractFile,
	Workspace,
	App,
} from "obsidian";
import { debounce } from "lodash-es";
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
	const base = "https://mxmind.com";
	//const base = "http://localhost:3000";
	return (
		base +
		"/mindmap/new?utm_source=obsidian&utm_medium=plugin&theme=" +
		getTheme() +
		"&lng=" +
		getLanguage()
	);
};

async function file2mindmap(file: TAbstractFile, update = false) {
	const content = await this.app.vault.cachedRead(file);
	//console.log(content)
	const post = () => {
		postIframeMessage(update ? "updateFromMarkdown" : "loadFromMd", [
			content,
		]);
	};
	try {
		await waitEditor();
		post();
	} catch (e) {
		post();
	}
}
async function saveAndRevealFile(app: App, blob: Blob, filePath: string) {
	// 保存文件
	const arrayBuffer = await blob.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);
	const f = app.vault.getAbstractFileByPath(filePath);
	if (f) {
		app.vault.delete(f);
	}
	await app.vault.createBinary(filePath, uint8Array);

	// 获取保存的文件
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!file) return;

	// 在编辑器中打开文件
	//await app.workspace.getLeaf().openFile(file);

	// 在文件浏览器中定位文件
	const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
	if (fileExplorer && fileExplorer.view.revealInFolder) {
		fileExplorer.view.revealInFolder(file);
	}
}

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
			async (evt: MouseEvent) => {
				// Called when the user clicks the icon.
				//new Notice('This is a notice!');
				this.toggleView();
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension == "md") {
					await this.activateView();
					await file2mindmap(activeFile);
				}
			}
		);

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
							//const leaf = await this.activateView();
							await this.activateView();
							await file2mindmap(file);
						});
				});
			})
		);
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				postIframeMessage("setTheme", [getTheme()]);
			})
		);

		const onModify = debounce(
			async (file) => {
				// 保存当前活动视图引用
				const activeView =
					this.app.workspace.getActiveViewOfType(MarkdownView);

				// 验证是否是当前正在编辑的文件
				if (activeView && activeView.file === file) {
					// 在这里更新右侧的leaf
					const cursor = activeView.editor.getCursor();
					await file2mindmap(file, true);
					setTimeout(() => {
						activeView.editor.focus();
						// 可选:设置光标位置以确保可见
						activeView.editor.setCursor(cursor);
					}, 20);
				}
			},
			1500,
			{ trailing: true }
		);
		this.registerEvent(
			this.app.vault.on("modify", async (file) => {
				if (!ready) return;
				onModify(file);
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
		} else {
			// 如果视图不存在，打开它
			const leaf = workspace.getRightLeaf(false); // 在右侧创建新的叶子
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_EXAMPLE,
				});
				workspace.revealLeaf(leaf);
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
			if (event.data.method == "download") {
				let [fileName, blob] = event.data.result;
				await saveAndRevealFile(
					this.app,
					blob,
					decodeURIComponent(fileName)
				);
				new Notice(trans("Download complete"));
			}
			console.log(event);
		};
	}

	async onClose() {
		// Nothing to clean up.
		ready = false;
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
	const cn: Record<string, string> = {
		"Copy image": "复制图片",
		"Open as mindmap": "转为思维导图",
		"Image copied to the clipboard.": "图片已经复制到剪切板。",
		"Download complete": "下载完成",
	};
	if (moment.locale().includes("zh")) {
		return cn[str] || str;
	}
	return str;
}
