# 第三方内容与署名

本项目包含以下第三方内容。它们各自适用其原许可；本说明不改变任何第三方许可，也不为本项目自有代码指定额外许可。

- **Salamander Grand Piano**：Alexander Holm，采样乐器 Yamaha C5，采用 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。来源为 [Tonejs/audio Salamander](https://github.com/Tonejs/audio/tree/efd8296360f9526e379bfbe5c1698ff54d6a1d34/salamander)。30 个 MP3 文件保持上游字节内容，播放时进行变调、音量和松键衰减处理。详见 [NOTICE](piano-android/web/samples/salamander/NOTICE.txt)、[上游 README](piano-android/web/samples/salamander/README.upstream.txt) 与 [采样清单](piano-android/web/samples/salamander/manifest.json)。
- **Bravura**：乐谱字形依据随附的 [SIL Open Font License 声明](piano-android/native/assets/Bravura-OFL.txt)使用。
- **OpenSheetMusicDisplay**：曲谱排版引擎，详见 [许可](piano-android/web/vendor/OSMD-LICENSE.txt)及[第三方声明](piano-android/web/vendor/OSMD-THIRD-PARTY-NOTICES.txt)。
- **fflate**：压缩 MusicXML 处理，详见 [MIT 许可](piano-android/web/vendor/FFLATE-LICENSE.txt)。
- **Babel**：构建时 JavaScript 编译工具，详见 [MIT 许可](piano-android/web/vendor/BABEL-LICENSE.txt)。

钢琴播放器由本项目实现，未引入 Tone.js 代码依赖。原作者未为本应用提供背书。
