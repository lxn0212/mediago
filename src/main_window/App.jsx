import React from "react";
import { remote, ipcRenderer } from "electron";
import "./App.scss";
import {
  MessageBar,
  MessageBarType,
  PrimaryButton,
  Stack,
  TextField,
  Separator,
  DefaultButton,
  Dropdown,
} from "@fluentui/react";
import { AiOutlineClose } from "react-icons/ai";
import { ipcExec, ipcGetStore, ipcSetStore } from "./utils";
import tdApp from "../renderer_common/td";

class App extends React.Component {
  binaryFileOptions = [
    {
      key: "N_m3u8DL-CLI",
      text: "N_m3u8DL-CLI（推荐）",
    },
    {
      key: "mediago",
      text: "mediago",
    },
  ];

  constructor(props) {
    super(props);

    this.state = {
      dir: "",
      exeFile: "",
      name: "",
      url: "",
      headers: "",
      m3u8List: [],
      showError: false,
      errorMsg: "",
    };
  }

  async componentDidMount() {
    ipcRenderer.on("m3u8", this.handleWebViewMessage);

    const dir = await ipcGetStore("local");
    const exeFile = await ipcGetStore("exeFile");
    this.setState({
      dir: dir || "",
      exeFile: exeFile || "",
    });
  }

  componentWillUnmount() {
    ipcRenderer.removeListener("m3u8", this.handleWebViewMessage);
  }

  handleSelectDir = async () => {
    const { dir } = this.state;
    const result = remote.dialog.showOpenDialogSync({
      defaultPath: dir || remote.app.getPath("documents"),
      properties: ["openDirectory"],
    });
    if (!result) return;
    const local = result[0];
    await ipcSetStore("local", local);
    this.setState({
      dir: local,
    });
  };

  handleSelectExeFile = async (event, options) => {
    await ipcSetStore("exeFile", options.key);
    this.setState({
      exeFile: options.key,
    });
  };

  handleWebViewMessage = (e, ...args) => {
    const [m3u8Object] = args;
    const { m3u8List } = this.state;
    if (
      m3u8List.findIndex(
        (item) => item.requestDetails.url === m3u8Object.requestDetails.url
      ) < 0
    ) {
      this.setState({
        m3u8List: [...m3u8List, m3u8Object],
      });
    }
  };

  handleStartDownload = async () => {
    tdApp.onEvent("下载页面", "开始下载");
    this.setState({ showError: false, errorMsg: "" });

    const { dir, exeFile, name, url, headers } = this.state;

    if (!dir) {
      this.setState({ errorMsg: "请配置本地路径", showError: true });
      return;
    }

    if (!exeFile) {
      this.setState({ errorMsg: "请选择执行程序", showError: true });
      return;
    }

    if (!name) {
      this.setState({ errorMsg: "请输入视频名称", showError: true });
      return;
    }

    if (!url) {
      this.setState({ errorMsg: "请输入 m3u8 地址", showError: true });
      return;
    }

    const { code, msg } = await ipcExec(exeFile, dir, name, url, headers);
    if (code === 0) {
      tdApp.onEvent("下载页面", "下载视频成功", { code, msg, url, exeFile });
    } else {
      this.setState({ showError: true, errorMsg: msg });
      tdApp.onEvent("下载页面", "下载视频失败", { code, msg, url, exeFile });
    }
  };

  handleClickM3U8Item = (item) => {
    this.setState({ showError: false, errorMsg: "" });
    const { exeFile } = this.state;
    const { title, requestDetails } = item;
    const { requestHeaders, url } = requestDetails;
    const headers = Object.keys(requestHeaders)
      .reduce((result, key) => {
        if (exeFile === "mediago") {
          result.push(`${key}~${requestHeaders[key]}`);
        } else {
          result.push(`${key}:${requestHeaders[key]}`);
        }
        return result;
      }, [])
      .join("|");
    this.setState({ name: title, url, headers });
  };

  handleOpenBrowserWindow = () => {
    tdApp.onEvent("下载页面", "打开浏览器页面");
    ipcRenderer.send("openBrowserWindow");
  };

  renderErrorMsg = () => {
    const { errorMsg, showError } = this.state;
    return (
      showError && (
        <MessageBar messageBarType={MessageBarType.error} isMultiline={false}>
          {errorMsg}
        </MessageBar>
      )
    );
  };

  render() {
    const { dir, exeFile, name, url, m3u8List, headers } = this.state;

    return (
      <div className="app">
        <div className="drag-region" />
        <div
          role="presentation"
          className="action-button"
          onClick={() => {
            ipcRenderer.send("closeMainWindow");
          }}
        >
          <AiOutlineClose />
        </div>
        <div className="download">
          {this.renderErrorMsg()}

          <Stack tokens={{ childrenGap: 5 }}>
            <TextField
              label="本地路径"
              required
              placeholder="请选择文件夹"
              value={dir}
              onRenderSuffix={() => (
                <div
                  role="presentation"
                  style={{ cursor: "pointer" }}
                  onClick={this.handleSelectDir}
                >
                  选择文件夹
                </div>
              )}
            />

            <Dropdown
              placeholder="请选择执行程序"
              label="请选择执行程序"
              options={this.binaryFileOptions}
              selectedKey={exeFile}
              onChange={this.handleSelectExeFile}
              required
            />

            <TextField
              required
              label="视频名称"
              value={name}
              onChange={(e) => this.setState({ name: e.target.value })}
            />

            <TextField
              required
              label="m3u8 链接"
              value={url}
              onChange={(e) => this.setState({ url: e.target.value })}
            />

            <TextField
              label="请求头"
              value={headers}
              onChange={(e) => this.setState({ headers: e.target.value })}
            />

            <div className="form-item">
              <Stack horizontal tokens={{ childrenGap: 15 }}>
                <PrimaryButton onClick={this.handleStartDownload}>
                  开始下载
                </PrimaryButton>

                <PrimaryButton onClick={this.handleOpenBrowserWindow}>
                  打开浏览器
                </PrimaryButton>

                {m3u8List.length > 0 && (
                  <PrimaryButton
                    onClick={() => {
                      this.setState({
                        m3u8List: [],
                      });
                    }}
                  >
                    清除列表
                  </PrimaryButton>
                )}

                <DefaultButton
                  onClick={async () => {
                    await remote.shell.openExternal(
                      "https://blog.ziying.site/post/media-downloader-how-to-use/?form=client"
                    );
                  }}
                >
                  使用帮助
                </DefaultButton>
              </Stack>
            </div>
          </Stack>

          {m3u8List.length > 0 && <Separator>辅助链接</Separator>}

          <div className="m3u8-list">
            {m3u8List.map((item) => (
              <div
                role="presentation"
                className="m3u8-item"
                key={item.requestDetails.url}
                onClick={() => this.handleClickM3U8Item(item)}
              >
                <div className="title">
                  标题：
                  {item.title}
                </div>
                <div className="url">
                  链接：
                  {item.requestDetails.url.split("?")[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="toolbar">
          <div className="left" />
          <div className="right" />
        </div>
      </div>
    );
  }
}

export default App;
