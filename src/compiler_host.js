"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const ts = require("typescript");
const dev = Math.floor(Math.random() * 10000);
class WebpackCompilerHost {
    constructor(_options, basePath, host, cacheSourceFiles, directTemplateLoading = false) {
        this._options = _options;
        this.cacheSourceFiles = cacheSourceFiles;
        this.directTemplateLoading = directTemplateLoading;
        this._changedFiles = new Set();
        this._sourceFileCache = new Map();
        this._virtualFileExtensions = [
            '.js', '.js.map',
            '.ngfactory.js', '.ngfactory.js.map',
            '.ngstyle.js', '.ngstyle.js.map',
            '.ngsummary.json',
        ];
        this._syncHost = new core_1.virtualFs.SyncDelegateHost(host);
        this._memoryHost = new core_1.virtualFs.SyncDelegateHost(new core_1.virtualFs.SimpleMemoryHost());
        this._basePath = core_1.normalize(basePath);
    }
    get virtualFiles() {
        return [...this._memoryHost.delegate
                ._cache.keys()];
    }
    denormalizePath(path) {
        return core_1.getSystemPath(core_1.normalize(path));
    }
    resolve(path) {
        const p = core_1.normalize(path);
        if (core_1.isAbsolute(p)) {
            return p;
        }
        else {
            return core_1.join(this._basePath, p);
        }
    }
    resetChangedFileTracker() {
        this._changedFiles.clear();
    }
    getChangedFilePaths() {
        return [...this._changedFiles];
    }
    getNgFactoryPaths() {
        return this.virtualFiles
            .filter(fileName => fileName.endsWith('.ngfactory.js') || fileName.endsWith('.ngstyle.js'))
            // These paths are used by the virtual file system decorator so we must denormalize them.
            .map(path => this.denormalizePath(path));
    }
    invalidate(fileName) {
        const fullPath = this.resolve(fileName);
        this._sourceFileCache.delete(fullPath);
        let exists = false;
        try {
            exists = this._syncHost.isFile(fullPath);
            if (exists) {
                this._changedFiles.add(fullPath);
            }
        }
        catch (_a) { }
        // File doesn't exist anymore and is not a factory, so we should delete the related
        // virtual files.
        if (!exists && fullPath.endsWith('.ts') && !(fullPath.endsWith('.ngfactory.ts') || fullPath.endsWith('.shim.ngstyle.ts'))) {
            this._virtualFileExtensions.forEach(ext => {
                const virtualFile = (fullPath.slice(0, -3) + ext);
                if (this._memoryHost.exists(virtualFile)) {
                    this._memoryHost.delete(virtualFile);
                }
            });
        }
        // In case resolveJsonModule and allowJs we also need to remove virtual emitted files
        // both if they exists or not.
        if ((fullPath.endsWith('.js') || fullPath.endsWith('.json'))
            && !/(\.(ngfactory|ngstyle)\.js|ngsummary\.json)$/.test(fullPath)) {
            if (this._memoryHost.exists(fullPath)) {
                this._memoryHost.delete(fullPath);
            }
        }
    }
    fileExists(fileName, delegate = true) {
        const p = this.resolve(fileName);
        if (this._memoryHost.isFile(p)) {
            return true;
        }
        if (!delegate) {
            return false;
        }
        let exists = false;
        try {
            exists = this._syncHost.isFile(p);
        }
        catch (_a) { }
        return exists;
    }
    readFile(fileName) {
        const filePath = this.resolve(fileName);
        try {
            if (this._memoryHost.isFile(filePath)) {
                return core_1.virtualFs.fileBufferToString(this._memoryHost.read(filePath));
            }
            else {
                const content = this._syncHost.read(filePath);
                return core_1.virtualFs.fileBufferToString(content);
            }
        }
        catch (_a) {
            return undefined;
        }
    }
    readFileBuffer(fileName) {
        const filePath = this.resolve(fileName);
        if (this._memoryHost.isFile(filePath)) {
            return Buffer.from(this._memoryHost.read(filePath));
        }
        else {
            const content = this._syncHost.read(filePath);
            return Buffer.from(content);
        }
    }
    _makeStats(stats) {
        return {
            isFile: () => stats.isFile(),
            isDirectory: () => stats.isDirectory(),
            isBlockDevice: () => stats.isBlockDevice && stats.isBlockDevice() || false,
            isCharacterDevice: () => stats.isCharacterDevice && stats.isCharacterDevice() || false,
            isFIFO: () => stats.isFIFO && stats.isFIFO() || false,
            isSymbolicLink: () => stats.isSymbolicLink && stats.isSymbolicLink() || false,
            isSocket: () => stats.isSocket && stats.isSocket() || false,
            dev: stats.dev === undefined ? dev : stats.dev,
            ino: stats.ino === undefined ? Math.floor(Math.random() * 100000) : stats.ino,
            mode: stats.mode === undefined ? parseInt('777', 8) : stats.mode,
            nlink: stats.nlink === undefined ? 1 : stats.nlink,
            uid: stats.uid || 0,
            gid: stats.gid || 0,
            rdev: stats.rdev || 0,
            size: stats.size,
            blksize: stats.blksize === undefined ? 512 : stats.blksize,
            blocks: stats.blocks === undefined ? Math.ceil(stats.size / 512) : stats.blocks,
            atime: stats.atime,
            atimeMs: stats.atime.getTime(),
            mtime: stats.mtime,
            mtimeMs: stats.mtime.getTime(),
            ctime: stats.ctime,
            ctimeMs: stats.ctime.getTime(),
            birthtime: stats.birthtime,
            birthtimeMs: stats.birthtime.getTime(),
        };
    }
    stat(path) {
        const p = this.resolve(path);
        let stats = null;
        try {
            stats = this._memoryHost.stat(p) || this._syncHost.stat(p);
        }
        catch (_a) { }
        if (!stats) {
            return null;
        }
        if (stats instanceof fs_1.Stats) {
            return stats;
        }
        return this._makeStats(stats);
    }
    directoryExists(directoryName) {
        const p = this.resolve(directoryName);
        try {
            return this._memoryHost.isDirectory(p) || this._syncHost.isDirectory(p);
        }
        catch (_a) {
            return false;
        }
    }
    getDirectories(path) {
        const p = this.resolve(path);
        let delegated;
        try {
            delegated = this._syncHost.list(p).filter(x => {
                try {
                    return this._syncHost.isDirectory(core_1.join(p, x));
                }
                catch (_a) {
                    return false;
                }
            });
        }
        catch (_a) {
            delegated = [];
        }
        let memory;
        try {
            memory = this._memoryHost.list(p).filter(x => {
                try {
                    return this._memoryHost.isDirectory(core_1.join(p, x));
                }
                catch (_a) {
                    return false;
                }
            });
        }
        catch (_b) {
            memory = [];
        }
        return [...new Set([...delegated, ...memory])];
    }
    getSourceFile(fileName, languageVersion, onError) {
        const p = this.resolve(fileName);
        try {
            const cached = this._sourceFileCache.get(p);
            if (cached) {
                return cached;
            }
            const content = this.readFile(fileName);
            if (content !== undefined) {
                const sf = ts.createSourceFile(workaroundResolve(fileName), content, languageVersion, true);
                if (this.cacheSourceFiles) {
                    this._sourceFileCache.set(p, sf);
                }
                return sf;
            }
        }
        catch (e) {
            if (onError) {
                onError(e.message);
            }
        }
        return undefined;
    }
    getDefaultLibFileName(options) {
        return ts.createCompilerHost(options).getDefaultLibFileName(options);
    }
    // This is due to typescript CompilerHost interface being weird on writeFile. This shuts down
    // typings in WebStorm.
    get writeFile() {
        return (fileName, data, _writeByteOrderMark, onError, _sourceFiles) => {
            const p = this.resolve(fileName);
            try {
                this._memoryHost.write(p, core_1.virtualFs.stringToFileBuffer(data));
            }
            catch (e) {
                if (onError) {
                    onError(e.message);
                }
            }
        };
    }
    getCurrentDirectory() {
        return this._basePath;
    }
    getCanonicalFileName(fileName) {
        const path = this.resolve(fileName);
        return this.useCaseSensitiveFileNames ? path : path.toLowerCase();
    }
    useCaseSensitiveFileNames() {
        return !process.platform.startsWith('win32');
    }
    getNewLine() {
        return '\n';
    }
    setResourceLoader(resourceLoader) {
        this._resourceLoader = resourceLoader;
    }
    readResource(fileName) {
        if (this.directTemplateLoading &&
            (fileName.endsWith('.html') || fileName.endsWith('.svg'))) {
            return this.readFile(fileName);
        }
        if (this._resourceLoader) {
            // These paths are meant to be used by the loader so we must denormalize them.
            const denormalizedFileName = this.denormalizePath(core_1.normalize(fileName));
            return this._resourceLoader.get(denormalizedFileName);
        }
        else {
            return this.readFile(fileName);
        }
    }
    trace(message) {
        console.log(message);
    }
}
exports.WebpackCompilerHost = WebpackCompilerHost;
// `TsCompilerAotCompilerTypeCheckHostAdapter` in @angular/compiler-cli seems to resolve module
// names directly via `resolveModuleName`, which prevents full Path usage.
// To work around this we must provide the same path format as TS internally uses in
// the SourceFile paths.
function workaroundResolve(path) {
    return core_1.getSystemPath(core_1.normalize(path)).replace(/\\/g, '/');
}
exports.workaroundResolve = workaroundResolve;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXJfaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvbmd0b29scy93ZWJwYWNrL3NyYy9jb21waWxlcl9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsK0NBTzhCO0FBQzlCLDJCQUEyQjtBQUMzQixpQ0FBaUM7QUFTakMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUM7QUFHOUMsTUFBYSxtQkFBbUI7SUFlOUIsWUFDVSxRQUE0QixFQUNwQyxRQUFnQixFQUNoQixJQUFvQixFQUNILGdCQUF5QixFQUN6Qix3QkFBd0IsS0FBSztRQUp0QyxhQUFRLEdBQVIsUUFBUSxDQUFvQjtRQUduQixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQVM7UUFDekIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUFRO1FBakJ4QyxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFHbEMscUJBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQXlCLENBQUM7UUFDcEQsMkJBQXNCLEdBQUc7WUFDL0IsS0FBSyxFQUFFLFNBQVM7WUFDaEIsZUFBZSxFQUFFLG1CQUFtQjtZQUNwQyxhQUFhLEVBQUUsaUJBQWlCO1lBQ2hDLGlCQUFpQjtTQUNsQixDQUFDO1FBVUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLGdCQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLGdCQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxnQkFBUyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztRQUNwRixJQUFJLENBQUMsU0FBUyxHQUFHLGdCQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVELElBQVksWUFBWTtRQUN0QixPQUFPLENBQUMsR0FBSSxJ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QUNMLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNoQztJQUNILENBQUM7SUFFRCxLQUFLLENBQUMsT0FBZTtRQUNuQixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7Q0FDRjtBQXhVRCxrREF3VUM7QUFHRCwrRkFBK0Y7QUFDL0YsMEVBQTBFO0FBQzFFLG9GQUFvRjtBQUNwRix3QkFBd0I7QUFDeEIsU0FBZ0IsaUJBQWlCLENBQUMsSUFBbUI7SUFDbkQsT0FBTyxvQkFBYSxDQUFDLGdCQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzVELENBQUM7QUFGRCw4Q0FFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7XG4gIFBhdGgsXG4gIGdldFN5c3RlbVBhdGgsXG4gIGlzQWJzb2x1dGUsXG4gIGpvaW4sXG4gIG5vcm1hbGl6ZSxcbiAgdmlydHVhbEZzLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBTdGF0cyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgV2VicGFja1Jlc291cmNlTG9hZGVyIH0gZnJvbSAnLi9yZXNvdXJjZV9sb2FkZXInO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgT25FcnJvckZuIHtcbiAgKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQ7XG59XG5cblxuY29uc3QgZGV2ID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDApO1xuXG5cbmV4cG9ydCBjbGFzcyBXZWJwYWNrQ29tcGlsZXJIb3N0IGltcGxlbWVudHMgdHMuQ29tcGlsZXJIb3N0IHtcbiAgcHJpdmF0ZSBfc3luY0hvc3Q6IHZpcnR1YWxGcy5TeW5jRGVsZWdhdGVIb3N0O1xuICBwcml2YXRlIF9tZW1vcnlIb3N0OiB2aXJ0dWFsRnMuU3luY0RlbGVnYXRlSG9zdDtcbiAgcHJpdmF0ZSBfY2hhbmdlZEZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHByaXZhdGUgX2Jhc2VQYXRoOiBQYXRoO1xuICBwcml2YXRlIF9yZXNvdXJjZUxvYWRlcj86IFdlYnBhY2tSZXNvdXJjZUxvYWRlcjtcbiAgcHJpdmF0ZSBfc291cmNlRmlsZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHRzLlNvdXJjZUZpbGU+KCk7XG4gIHByaXZhdGUgX3ZpcnR1YWxGaWxlRXh0ZW5zaW9ucyA9IFtcbiAgICAnLmpzJywgJy5qcy5tYXAnLFxuICAgICcubmdmYWN0b3J5LmpzJywgJy5uZ2ZhY3RvcnkuanMubWFwJyxcbiAgICAnLm5nc3R5bGUuanMnLCAnLm5nc3R5bGUuanMubWFwJyxcbiAgICAnLm5nc3VtbWFyeS5qc29uJyxcbiAgXTtcblxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgX29wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucyxcbiAgICBiYXNlUGF0aDogc3RyaW5nLFxuICAgIGhvc3Q6IHZpcnR1YWxGcy5Ib3N0LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2FjaGVTb3VyY2VGaWxlczogYm9vbGVhbixcbiAgICBwcml2YXRlIHJlYWRvbmx5IGRpcmVjdFRlbXBsYXRlTG9hZGluZyA9IGZhbHNlLFxuICApIHtcbiAgICB0aGlzLl9zeW5jSG9zdCA9IG5ldyB2aXJ0dWFsRnMuU3luY0RlbGVnYXRlSG9zdChob3N0KTtcbiAgICB0aGlzLl9tZW1vcnlIb3N0ID0gbmV3IHZpcnR1YWxGcy5TeW5jRGVsZWdhdGVIb3N0KG5ldyB2aXJ0dWFsRnMuU2ltcGxlTWVtb3J5SG9zdCgpKTtcbiAgICB0aGlzLl9iYXNlUGF0aCA9IG5vcm1hbGl6ZShiYXNlUGF0aCk7XG4gIH1cblxuICBwcml2YXRlIGdldCB2aXJ0dWFsRmlsZXMoKTogUGF0aFtdIHtcbiAgICByZXR1cm4gWy4uLih0aGlzLl9tZW1vcnlIb3N0LmRlbGVnYXRlIGFzIHt9IGFzIHsgX2NhY2hlOiBNYXA8UGF0aCwge30+IH0pXG4gICAgICAuX2NhY2hlLmtleXMoKV07XG4gIH1cblxuICBkZW5vcm1hbGl6ZVBhdGgocGF0aDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGdldFN5c3RlbVBhdGgobm9ybWFsaXplKHBhdGgpKTtcbiAgfVxuXG4gIHJlc29sdmUocGF0aDogc3RyaW5nKTogUGF0aCB7XG4gICAgY29uc3QgcCA9IG5vcm1hbGl6ZShwYXRoKTtcbiAgICBpZiAoaXNBYnNvbHV0ZShwKSkge1xuICAgICAgcmV0dXJuIHA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBqb2luKHRoaXMuX2Jhc2VQYXRoLCBwKTtcbiAgICB9XG4gIH1cblxuICByZXNldENoYW5nZWRGaWxlVHJhY2tlcigpIHtcbiAgICB0aGlzLl9jaGFuZ2VkRmlsZXMuY2xlYXIoKTtcbiAgfVxuXG4gIGdldENoYW5nZWRGaWxlUGF0aHMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBbLi4udGhpcy5fY2hhbmdlZEZpbGVzXTtcbiAgfVxuXG4gIGdldE5nRmFjdG9yeVBhdGhzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gdGhpcy52aXJ0dWFsRmlsZXNcbiAgICAgIC5maWx0ZXIoZmlsZU5hbWUgPT4gZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ2ZhY3RvcnkuanMnKSB8fCBmaWxlTmFtZS5lbmRzV2l0aCgnLm5nc3R5bGUuanMnKSlcbiAgICAgIC8vIFRoZXNlIHBhdGhzIGFyZSB1c2VkIGJ5IHRoZSB2aXJ0dWFsIGZpbGUgc3lzdGVtIGRlY29yYXRvciBzbyB3ZSBtdXN0IGRlbm9ybWFsaXplIHRoZW0uXG4gICAgICAubWFwKHBhdGggPT4gdGhpcy5kZW5vcm1hbGl6ZVBhdGgocGF0aCkpO1xuICB9XG5cbiAgaW52YWxpZGF0ZShmaWxlTmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZnVsbFBhdGggPSB0aGlzLnJlc29sdmUoZmlsZU5hbWUpO1xuICAgIHRoaXMuX3NvdXJjZUZpbGVDYWNoZS5kZWxldGUoZnVsbFBhdGgpO1xuXG4gICAgbGV0IGV4aXN0cyA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICBleGlzdHMgPSB0aGlzLl9zeW5jSG9zdC5pc0ZpbGUoZnVsbFBhdGgpO1xuICAgICAgaWYgKGV4aXN0cykge1xuICAgICAgICB0aGlzLl9jaGFuZ2VkRmlsZXMuYWRkKGZ1bGxQYXRoKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHsgfVxuXG4gICAgLy8gRmlsZSBkb2Vzbid0IGV4aXN0IGFueW1vcmUgYW5kIGlzIG5vdCBhIGZhY3RvcnksIHNvIHdlIHNob3VsZCBkZWxldGUgdGhlIHJlbGF0ZWRcbiAgICAvLyB2aXJ0dWFsIGZpbGVzLlxuICAgIGlmICghZXhpc3RzICYmIGZ1bGxQYXRoLmVuZHNXaXRoKCcudHMnKSAmJiAhKFxuICAgICAgZnVsbFBhdGguZW5kc1dpdGgoJy5uZ2ZhY3RvcnkudHMnKSB8fCBmdWxsUGF0aC5lbmRzV2l0aCgnLnNoaW0ubmdzdHlsZS50cycpXG4gICAgKSkge1xuICAgICAgdGhpcy5fdmlydHVhbEZpbGVFeHRlbnNpb25zLmZvckVhY2goZXh0ID0+IHtcbiAgICAgICAgY29uc3QgdmlydHVhbEZpbGUgPSAoZnVsbFBhdGguc2xpY2UoMCwgLTMpICsgZXh0KSBhcyBQYXRoO1xuICAgICAgICBpZiAodGhpcy5fbWVtb3J5SG9zdC5leGlzdHModmlydHVhbEZpbGUpKSB7XG4gICAgICAgICAgdGhpcy5fbWVtb3J5SG9zdC5kZWxldGUodmlydHVhbEZpbGUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBJbiBjYXNlIHJlc29sdmVKc29uTW9kdWxlIGFuZCBhbGxvd0pzIHdlIGFsc28gbmVlZCB0byByZW1vdmUgdmlydHVhbCBlbWl0dGVkIGZpbGVzXG4gICAgLy8gYm90aCBpZiB0aGV5IGV4aXN0cyBvciBub3QuXG4gICAgaWYgKChmdWxsUGF0aC5lbmRzV2l0aCgnLmpzJykgfHwgZnVsbFBhdGguZW5kc1dpdGgoJy5qc29uJykpXG4gICAgICAmJiAhLyhcXC4obmdmYWN0b3J5fG5nc3R5bGUpXFwuanN8bmdzdW1tYXJ5XFwuanNvbikkLy50ZXN0KGZ1bGxQYXRoKSkge1xuICAgICAgaWYgKHRoaXMuX21lbW9yeUhvc3QuZXhpc3RzKGZ1bGxQYXRoKSkge1xuICAgICAgICB0aGlzLl9tZW1vcnlIb3N0LmRlbGV0ZShmdWxsUGF0aCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZmlsZUV4aXN0cyhmaWxlTmFtZTogc3RyaW5nLCBkZWxlZ2F0ZSA9IHRydWUpOiBib29sZWFuIHtcbiAgICBjb25zdCBwID0gdGhpcy5yZXNvbHZlKGZpbGVOYW1lKTtcblxuICAgIGlmICh0aGlzLl9tZW1vcnlIb3N0LmlzRmlsZShwKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCFkZWxlZ2F0ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGxldCBleGlzdHMgPSBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgZXhpc3RzID0gdGhpcy5fc3luY0hvc3QuaXNGaWxlKHApO1xuICAgIH0gY2F0Y2ggeyB9XG5cbiAgICByZXR1cm4gZXhpc3RzO1xuICB9XG5cbiAgcmVhZEZpbGUoZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgZmlsZVBhdGggPSB0aGlzLnJlc29sdmUoZmlsZU5hbWUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGlmICh0aGlzLl9tZW1vcnlIb3N0LmlzRmlsZShmaWxlUGF0aCkpIHtcbiAgICAgICAgcmV0dXJuIHZpcnR1YWxGcy5maWxlQnVmZmVyVG9TdHJpbmcodGhpcy5fbWVtb3J5SG9zdC5yZWFkKGZpbGVQYXRoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gdGhpcy5fc3luY0hvc3QucmVhZChmaWxlUGF0aCk7XG5cbiAgICAgICAgcmV0dXJuIHZpcnR1YWxGcy5maWxlQnVmZmVyVG9TdHJpbmcoY29udGVudCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIHJlYWRGaWxlQnVmZmVyKGZpbGVOYW1lOiBzdHJpbmcpOiBCdWZmZXIge1xuICAgIGNvbnN0IGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlKGZpbGVOYW1lKTtcblxuICAgIGlmICh0aGlzLl9tZW1vcnlIb3N0LmlzRmlsZShmaWxlUGF0aCkpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0aGlzLl9tZW1vcnlIb3N0LnJlYWQoZmlsZVBhdGgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY29udGVudCA9IHRoaXMuX3N5bmNIb3N0LnJlYWQoZmlsZVBhdGgpO1xuXG4gICAgICByZXR1cm4gQnVmZmVyLmZyb20oY29udGVudCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfbWFrZVN0YXRzKHN0YXRzOiB2aXJ0dWFsRnMuU3RhdHM8UGFydGlhbDxTdGF0cz4+KTogU3RhdHMge1xuICAgIHJldHVybiB7XG4gICAgICBpc0ZpbGU6ICgpID0+IHN0YXRzLmlzRmlsZSgpLFxuICAgICAgaXNEaXJlY3Rvcnk6ICgpID0+IHN0YXRzLmlzRGlyZWN0b3J5KCksXG4gICAgICBpc0Jsb2NrRGV2aWNlOiAoKSA9PiBzdGF0cy5pc0Jsb2NrRGV2aWNlICYmIHN0YXRzLmlzQmxvY2tEZXZpY2UoKSB8fCBmYWxzZSxcbiAgICAgIGlzQ2hhcmFjdGVyRGV2aWNlOiAoKSA9PiBzdGF0cy5pc0NoYXJhY3RlckRldmljZSAmJiBzdGF0cy5pc0NoYXJhY3RlckRldmljZSgpIHx8IGZhbHNlLFxuICAgICAgaXNGSUZPOiAoKSA9PiBzdGF0cy5pc0ZJRk8gJiYgc3RhdHMuaXNGSUZPKCkgfHwgZmFsc2UsXG4gICAgICBpc1N5bWJvbGljTGluazogKCkgPT4gc3RhdHMuaXNTeW1ib2xpY0xpbmsgJiYgc3RhdHMuaXNTeW1ib2xpY0xpbmsoKSB8fCBmYWxzZSxcbiAgICAgIGlzU29ja2V0OiAoKSA9PiBzdGF0cy5pc1NvY2tldCAmJiBzdGF0cy5pc1NvY2tldCgpIHx8IGZhbHNlLFxuICAgICAgZGV2OiBzdGF0cy5kZXYgPT09IHVuZGVmaW5lZCA/IGRldiA6IHN0YXRzLmRldixcbiAgICAgIGlubzogc3RhdHMuaW5vID09PSB1bmRlZmluZWQgPyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDApIDogc3RhdHMuaW5vLFxuICAgICAgbW9kZTogc3RhdHMubW9kZSA9PT0gdW5kZWZpbmVkID8gcGFyc2VJbnQoJzc3NycsIDgpIDogc3RhdHMubW9kZSxcbiAgICAgIG5saW5rOiBzdGF0cy5ubGluayA9PT0gdW5kZWZpbmVkID8gMSA6IHN0YXRzLm5saW5rLFxuICAgICAgdWlkOiBzdGF0cy51aWQgfHwgMCxcbiAgICAgIGdpZDogc3RhdHMuZ2lkIHx8IDAsXG4gICAgICByZGV2OiBzdGF0cy5yZGV2IHx8IDAsXG4gICAgICBzaXplOiBzdGF0cy5zaXplLFxuICAgICAgYmxrc2l6ZTogc3RhdHMuYmxrc2l6ZSA9PT0gdW5kZWZpbmVkID8gNTEyIDogc3RhdHMuYmxrc2l6ZSxcbiAgICAgIGJsb2Nrczogc3RhdHMuYmxvY2tzID09PSB1bmRlZmluZWQgPyBNYXRoLmNlaWwoc3RhdHMuc2l6ZSAvIDUxMikgOiBzdGF0cy5ibG9ja3MsXG4gICAgICBhdGltZTogc3RhdHMuYXRpbWUsXG4gICAgICBhdGltZU1zOiBzdGF0cy5hdGltZS5nZXRUaW1lKCksXG4gICAgICBtdGltZTogc3RhdHMubXRpbWUsXG4gICAgICBtdGltZU1zOiBzdGF0cy5tdGltZS5nZXRUaW1lKCksXG4gICAgICBjdGltZTogc3RhdHMuY3RpbWUsXG4gICAgICBjdGltZU1zOiBzdGF0cy5jdGltZS5nZXRUaW1lKCksXG4gICAgICBiaXJ0aHRpbWU6IHN0YXRzLmJpcnRodGltZSxcbiAgICAgIGJpcnRodGltZU1zOiBzdGF0cy5iaXJ0aHRpbWUuZ2V0VGltZSgpLFxuICAgIH07XG4gIH1cblxuICBzdGF0KHBhdGg6IHN0cmluZyk6IFN0YXRzIHwgbnVsbCB7XG4gICAgY29uc3QgcCA9IHRoaXMucmVzb2x2ZShwYXRoKTtcblxuICAgIGxldCBzdGF0czogdmlydHVhbEZzLlN0YXRzPFBhcnRpYWw8U3RhdHM+PiB8IFN0YXRzIHwgbnVsbCA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgIHN0YXRzID0gdGhpcy5fbWVtb3J5SG9zdC5zdGF0KHApIHx8IHRoaXMuX3N5bmNIb3N0LnN0YXQocCk7XG4gICAgfSBjYXRjaCB7IH1cblxuICAgIGlmICghc3RhdHMpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChzdGF0cyBpbnN0YW5jZW9mIFN0YXRzKSB7XG4gICAgICByZXR1cm4gc3RhdHM7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX21ha2VTdGF0cyhzdGF0cyk7XG4gIH1cblxuICBkaXJlY3RvcnlFeGlzdHMoZGlyZWN0b3J5TmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgcCA9IHRoaXMucmVzb2x2ZShkaXJlY3RvcnlOYW1lKTtcblxuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWVtb3J5SG9zdC5pc0RpcmVjdG9yeShwKSB8fCB0aGlzLl9zeW5jSG9zdC5pc0RpcmVjdG9yeShwKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBnZXREaXJlY3RvcmllcyhwYXRoOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgcCA9IHRoaXMucmVzb2x2ZShwYXRoKTtcblxuICAgIGxldCBkZWxlZ2F0ZWQ6IHN0cmluZ1tdO1xuICAgIHRyeSB7XG4gICAgICBkZWxlZ2F0ZWQgPSB0aGlzLl9zeW5jSG9zdC5saXN0KHApLmZpbHRlcih4ID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fc3luY0hvc3QuaXNEaXJlY3Rvcnkoam9pbihwLCB4KSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBkZWxlZ2F0ZWQgPSBbXTtcbiAgICB9XG5cbiAgICBsZXQgbWVtb3J5OiBzdHJpbmdbXTtcbiAgICB0cnkge1xuICAgICAgbWVtb3J5ID0gdGhpcy5fbWVtb3J5SG9zdC5saXN0KHApLmZpbHRlcih4ID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fbWVtb3J5SG9zdC5pc0RpcmVjdG9yeShqb2luKHAsIHgpKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIG1lbW9yeSA9IFtdO1xuICAgIH1cblxuICAgIHJldHVybiBbLi4ubmV3IFNldChbLi4uZGVsZWdhdGVkLCAuLi5tZW1vcnldKV07XG4gIH1cblxuICBnZXRTb3VyY2VGaWxlKGZpbGVOYW1lOiBzdHJpbmcsIGxhbmd1YWdlVmVyc2lvbjogdHMuU2NyaXB0VGFyZ2V0LCBvbkVycm9yPzogT25FcnJvckZuKSB7XG4gICAgY29uc3QgcCA9IHRoaXMucmVzb2x2ZShmaWxlTmFtZSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY2FjaGVkID0gdGhpcy5fc291cmNlRmlsZUNhY2hlLmdldChwKTtcbiAgICAgIGlmIChjYWNoZWQpIHtcbiAgICAgICAgcmV0dXJuIGNhY2hlZDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29udGVudCA9IHRoaXMucmVhZEZpbGUoZmlsZU5hbWUpO1xuICAgICAgaWYgKGNvbnRlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBzZiA9IHRzLmNyZWF0ZVNvdXJjZUZpbGUod29ya2Fyb3VuZFJlc29sdmUoZmlsZU5hbWUpLCBjb250ZW50LCBsYW5ndWFnZVZlcnNpb24sIHRydWUpO1xuXG4gICAgICAgIGlmICh0aGlzLmNhY2hlU291cmNlRmlsZXMpIHtcbiAgICAgICAgICB0aGlzLl9zb3VyY2VGaWxlQ2FjaGUuc2V0KHAsIHNmKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzZjtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAob25FcnJvcikge1xuICAgICAgICBvbkVycm9yKGUubWVzc2FnZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGdldERlZmF1bHRMaWJGaWxlTmFtZShvcHRpb25zOiB0cy5Db21waWxlck9wdGlvbnMpIHtcbiAgICByZXR1cm4gdHMuY3JlYXRlQ29tcGlsZXJIb3N0KG9wdGlvbnMpLmdldERlZmF1bHRMaWJGaWxlTmFtZShvcHRpb25zKTtcbiAgfVxuXG4gIC8vIFRoaXMgaXMgZHVlIHRvIHR5cGVzY3JpcHQgQ29tcGlsZXJIb3N0IGludGVyZmFjZSBiZWluZyB3ZWlyZCBvbiB3cml0ZUZpbGUuIFRoaXMgc2h1dHMgZG93blxuICAvLyB0eXBpbmdzIGluIFdlYlN0b3JtLlxuICBnZXQgd3JpdGVGaWxlKCkge1xuICAgIHJldHVybiAoXG4gICAgICBmaWxlTmFtZTogc3RyaW5nLFxuICAgICAgZGF0YTogc3RyaW5nLFxuICAgICAgX3dyaXRlQnl0ZU9yZGVyTWFyazogYm9vbGVhbixcbiAgICAgIG9uRXJyb3I/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkLFxuICAgICAgX3NvdXJjZUZpbGVzPzogUmVhZG9ubHlBcnJheTx0cy5Tb3VyY2VGaWxlPixcbiAgICApOiB2b2lkID0+IHtcbiAgICAgIGNvbnN0IHAgPSB0aGlzLnJlc29sdmUoZmlsZU5hbWUpO1xuXG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLl9tZW1vcnlIb3N0LndyaXRlKHAsIHZpcnR1YWxGcy5zdHJpbmdUb0ZpbGVCdWZmZXIoZGF0YSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAob25FcnJvcikge1xuICAgICAgICAgIG9uRXJyb3IoZS5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBnZXRDdXJyZW50RGlyZWN0b3J5KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuX2Jhc2VQYXRoO1xuICB9XG5cbiAgZ2V0Q2Fub25pY2FsRmlsZU5hbWUoZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcGF0aCA9IHRoaXMucmVzb2x2ZShmaWxlTmFtZSk7XG5cbiAgICByZXR1cm4gdGhpcy51c2VDYXNlU2Vuc2l0aXZlRmlsZU5hbWVzID8gcGF0aCA6IHBhdGgudG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIHVzZUNhc2VTZW5zaXRpdmVGaWxlTmFtZXMoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICFwcm9jZXNzLnBsYXRmb3JtLnN0YXJ0c1dpdGgoJ3dpbjMyJyk7XG4gIH1cblxuICBnZXROZXdMaW5lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICdcXG4nO1xuICB9XG5cbiAgc2V0UmVzb3VyY2VMb2FkZXIocmVzb3VyY2VMb2FkZXI6IFdlYnBhY2tSZXNvdXJjZUxvYWRlcikge1xuICAgIHRoaXMuX3Jlc291cmNlTG9hZGVyID0gcmVzb3VyY2VMb2FkZXI7XG4gIH1cblxuICByZWFkUmVzb3VyY2UoZmlsZU5hbWU6IHN0cmluZykge1xuICAgIGlmICh0aGlzLmRpcmVjdFRlbXBsYXRlTG9hZGluZyAmJlxuICAgICAgICAoZmlsZU5hbWUuZW5kc1dpdGgoJy5odG1sJykgfHwgZmlsZU5hbWUuZW5kc1dpdGgoJy5zdmcnKSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlYWRGaWxlKGZpbGVOYW1lKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fcmVzb3VyY2VMb2FkZXIpIHtcbiAgICAgIC8vIFRoZXNlIHBhdGhzIGFyZSBtZWFudCB0byBiZSB1c2VkIGJ5IHRoZSBsb2FkZXIgc28gd2UgbXVzdCBkZW5vcm1hbGl6ZSB0aGVtLlxuICAgICAgY29uc3QgZGVub3JtYWxpemVkRmlsZU5hbWUgPSB0aGlzLmRlbm9ybWFsaXplUGF0aChub3JtYWxpemUoZmlsZU5hbWUpKTtcblxuICAgICAgcmV0dXJuIHRoaXMuX3Jlc291cmNlTG9hZGVyLmdldChkZW5vcm1hbGl6ZWRGaWxlTmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnJlYWRGaWxlKGZpbGVOYW1lKTtcbiAgICB9XG4gIH1cblxuICB0cmFjZShtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBjb25zb2xlLmxvZyhtZXNzYWdlKTtcbiAgfVxufVxuXG5cbi8vIGBUc0NvbXBpbGVyQW90Q29tcGlsZXJUeXBlQ2hlY2tIb3N0QWRhcHRlcmAgaW4gQGFuZ3VsYXIvY29tcGlsZXItY2xpIHNlZW1zIHRvIHJlc29sdmUgbW9kdWxlXG4vLyBuYW1lcyBkaXJlY3RseSB2aWEgYHJlc29sdmVNb2R1bGVOYW1lYCwgd2hpY2ggcHJldmVudHMgZnVsbCBQYXRoIHVzYWdlLlxuLy8gVG8gd29yayBhcm91bmQgdGhpcyB3ZSBtdXN0IHByb3ZpZGUgdGhlIHNhbWUgcGF0aCBmb3JtYXQgYXMgVFMgaW50ZXJuYWxseSB1c2VzIGluXG4vLyB0aGUgU291cmNlRmlsZSBwYXRocy5cbmV4cG9ydCBmdW5jdGlvbiB3b3JrYXJvdW5kUmVzb2x2ZShwYXRoOiBQYXRoIHwgc3RyaW5nKSB7XG4gIHJldHVybiBnZXRTeXN0ZW1QYXRoKG5vcm1hbGl6ZShwYXRoKSkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xufVxuIl19