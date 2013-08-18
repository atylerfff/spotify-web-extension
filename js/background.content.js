function ContentScriptConnection(port, manager) {
    this._id = window.spwebconn_id++;
    this.port = port;
    this.manager = manager;
    port.onMessage.addListener( this.handle_message.bind(this) )
    port.onDisconnect.addListener( manager.handle_disconnect.bind(manager) )
    //this.send_to_content( { BGPID:BGPID, message: "background page received your connection. Thanks :-)", data: new Uint8Array([1,2,3,4]) } )
}

ContentScriptConnection.prototype = {
    handle_message: function(msg) {
        if (msg.message && msg.message.msgevt) {
            var data = msg.message.msgevt.data
            if (typeof data == "string") {
                // comes from content script postMessage, try to JSON parse and shit
                try {
                    data = JSON.parse(data)
                } catch(e) { }
                //console.log('handle message','SpotifyWebConnection'+this._id, msg.message.msgevt.type, data);
            } else {

                if (data.sender == "extension" && 
                    data.injected_script == config.pagename + '.inject.js' &&
                    data.extension_id == config.extension_id) {
                    
                    console.log('received message from main page javascript context',data);

                    if (data.message && data.message.payload && data.message.requestid) {
                        api.handle_webpage_api_response( data.message )
                    }

                }

            }
        } else {
            console.log('unhandled content script message',msg);
        }
    },
    send_to_content: function(msg) {
        this.port.postMessage( msg )
    },
    send_api_message_to_webpage: function(requestid, msg) {
        // special type of message
        this.port.postMessage( { requestid: requestid, cc: config.pagename, payload: msg } )
    }
}

function ContentScriptConnections() {
    this._tab_connections = {}
    this._connected = 0;
    this._pagename_tabs = {};
    this._active_pagename_tab = null;
}

ContentScriptConnections.prototype = {
    handle_connection: function(port) {
        var extconn = null;
        if (port.sender && port.sender.id == chrome.app.getDetails().id) {

            var tabId = port.sender.tab.id;
            console.log('content script connection from', port.name+'.js, url:', port.sender.url,'on tab',port.sender.tab.id);
            extconn = new ContentScriptConnection(port, this);

            console.assert( tabId );
            console.assert( ! this._tab_connections[tabId] )

            this._tab_connections[tabId] = extconn
            this._connected++;
            console.assert( Object.keys(this._tab_connections).length == this._connected );

            if (port.name == config.pagename + '.content_script') {
                this._pagename_tabs[ tabId ] = extconn

                if (! this._active_pagename_tab) {
                    this._active_pagename_tab = extconn
                }
            }
            console.log('Total extension connections now', this._connected);
        } else {
            console.log('unrecognized chrome extension message',port);
            port.disconnect()
        }
    },
    handle_disconnect: function(port) {
        var tabId = port.sender.tab.id
        console.log(port,'port disconnected', tabId, port);
        console.assert( tabId )

        if (port.name == config.pagename + '.content_script') {
            console.assert( this._tab_connections[tabId] )
            delete this._pagename_tabs[tabId]
            if (Object.keys( this._pagename_tabs ).length == 0) {
                this._active_pagename_tab = null;
            }
        }
        console.assert(this._tab_connections[tabId])
        delete this._tab_connections[tabId]
        this._connected--;
    },
    get_active: function() {
        return this._active_pagename_tab;
    }
}