import Peer from "peerjs";

import BroadcastFormat from "./dist-broadcast-format";

export default class Broadcast {
    constructor(onData = null) {
        // Fields.
        this.peer = new Peer({
            host: "192.168.0.104",
            port: 9000,
            path: "/doc",
            secure: true,
        });
        this.maxPeers = 5;
        this.inConnections = [];
        this.outConnections = [];
        this.peers = [];

        this.format = new BroadcastFormat();
        this._onData = onData; // Method that's called when data is received.

        // Initialize broadcast.
        this._bindOnOpen();
    }
    
    // Operations on connections.
    // Send data to a specific peer.
    send(connection, data) {
        connection.send(data);
    }

    // Send data to all (not excluded) peers.
    broadcast(content, exclude = []) {
        this.inConnections.forEach((connection) => { if (!exclude.includes(connection)) this.send(connection, content); });
        this.outConnections.forEach((connection) => { if (!exclude.includes(connection)) this.send(connection, content); });
    }

    // Choose next potential outcomming peer.
    choose() {
        if (this.peers.length > 1) { // At least two peers must be in the network.
            return this.peers[0] !== this.peer.id ? this.peers[0] : null;
        }
    }

    // Can this peer connect any more peers.
    canConnect() {
        return this.inConnections.length + this.outConnections.length < this.maxPeers;
    }

    // Connect to a peer.
    connect(id) {
        const connection = this.peer.connect(id);
        connection.on("open", () => {
            this._bindOnData(connection);
            this._bindOnClose(connection, this.outConnections);
            this._bindOnCloseChoose(connection);

            this.outConnections.push(connection);
            this.peers.push(connection.peer);

            this.broadcast(this.format.connection(connection.id), [connection]);
        });
        return connection;
    }

    // When this peer can no longer connect peers, this function chooses peer that may connect these peers.
    redirect(data) {
        this.send(this.inConnections[0] || this.outConnections[0], data);
    }

    // Event bindings.
    _bindOnOpen() {
        this.peer.on("open", () => {
            this.peers.push(this.peer.id);

            this._bindOnError();
            this._bindOnConnection();
            this._bindOnDisconnect();
        })
    }

    _bindOnError() {
        this.peer.on("error", (error) => {
            switch (error.type) {
                case "peer-unavailable": { console.error("peer-unavailable"); break; }
                default: { console.error(error); break; }
            }
        });
    }

    _bindOnConnection() {
        this.peer.on("connection", (connection) => {
            if (!this.canConnect()) {
                connection.close();
                this.redirect(this.format.redirect(connection.peer));
                return;
            }

            this._bindOnData(connection);
            this._bindOnClose(connection, this.inConnections);
            this._bindOnOpenConnection(connection);

            this.inConnections.push(connection);
            this.peers.push(connection.peer);

            this.broadcast(this.format.connection(connection.peer), [connection]);
        });
    }

    _bindOnData(connection) {
        connection.on("data", (data) => {
            if (this._onData) this._onData(data, connection);

            switch (data.type) {
                case "close": { this.peers.splice(this.peers.indexOf(data.data), 1); break; }
                case "connection": { this.peers.push(data.data); break; }
                case "table": { this.peers = data.data; return; } // Don't broadcast peers table.
                case "redirect": { this.canConnect() ? this.connect(data.data) : this.redirect(data); return; }
                case "content": return; // Content is handled outside.
                default: console.log("Unknown data:"); console.log(data);
            }

            // Send data further.
            this.broadcast(data, [connection]);
        })
    }

    _bindOnClose(connection, excludeFrom) {
        connection.on("close", () => {
            if (excludeFrom) excludeFrom.splice(excludeFrom.indexOf(connection), 1);
            this.peers.splice(this.peers.indexOf(connection.peer), 1);
            this.broadcast(this.format.close(connection.peer), [connection]);
        })
    }

    _bindOnCloseChoose(connection) {
        connection.on("close", () => {
            const peer = this.choose();
            if (!peer) return;
            this.connect(peer);
        });
    }

    _bindOnOpenConnection(connection) {
        connection.on("open", () => {
            this.send(connection, this.format.table(this.peers));
        });
    }

    _bindOnDisconnect() {
        this.peer.on("disconnected", () => {
            alert("The server that was used to establish communication between you and your peer has been outaged.");
        });
    }
}