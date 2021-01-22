export default class BroadcastFormat {
    _dataObj(type, data) {
        return {
            type: type,
            data: data
        };
    }

    // Data formats.
    content(content) { return this._dataObj("content", content); }
    connection(id) { return this._dataObj("connection", id); }
    close(id) { return this._dataObj("close", id); }
    table(table) { return this._dataObj("table", table); }
    redirect(id) { return this._dataObj("redirect", id); }
}