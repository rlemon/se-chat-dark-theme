"use strict";
var chat = document.getElementById('chat');
var userColorSheet = document.createElement('style');
var users = {
    lookup: function(name) {
        return name in this.data;
    },
    store: function(name, key, value) {
        // console.log('storing ' + name + ' as ' + value);
        this.data[name] = {
            key: key,
            value: value
        };
        this.writeToSheet(key, value);
        return value;
    },
    load: function(colorUsersData) {
        Object.keys(colorUsersData).forEach(function(user) {
            this.data[user] = {
                key: colorUsersData[user].key,
                value: colorUsersData[user].value
            };
            this.writeToSheet(colorUsersData[user].key, colorUsersData[user].value);
        }.bind(this));
    },
    save: function(cb) {
        chrome.storage.sync.set({
            so_colour_users: users.data
        }, cb);
    },
    writeToSheet: function(key, value) {
        var rules = Object.keys(options.useColorBorder).reduce(function(currentString, key) {
            currentString += options.useColorBorder[key] ? 'border-' + key + ': solid .25em ' + value + ' !important;' : '';
            return currentString;
        }, '');
        userColorSheet.textContent += '.' + key + ' .messages { ' + rules + ' } ';
    },
    data: {}
};
var options = {
    useColorBorder: {
        top: undefined,
        right: undefined, 
        bottom: undefined,
        left: undefined
    },
    webm: undefined
};
chrome.storage.sync.get({
    colorBorderPositions: {
        top: true,
        right: false, 
        bottom: false,
        left: false
    },
    webm: true,
    so_colour_users: {}
}, function(savedOptions) {
    options.useColorBorder = savedOptions.colorBorderPositions;
    options.webm = savedOptions.webm;
    init(savedOptions.so_colour_users);
});

function hashCode(str) {
    var hash = 0;
    str += '!';
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return -hash;
}

function colorCode(i) {
    // dear reader, my code formatter likes to do this from time to time...
    // I'm sick of fixing it and I'm not writing an exception to the extension. 
    // I'm sorry, deal with it. 
    return '#' + (Math.min((i >> 24) & 0xFF, 175).toString(16) + Math.min((i >> 16) & 0xFF, 175).toString(16) + Math.min((i >> 8) & 0xFF, 175).toString(16) + Math.min(i & 0xFF, 175).toString(16)).slice(0, 6);
}

function colorUsers(node) {
    if (node.classList && node.classList.contains('popup') && node.classList.contains('user-popup')) {
        var img = node.querySelector('img');
        var input = document.createElement('input');
        var name = node.querySelector('.username').textContent;
        input.type = 'color';
        input.value = users.data[name].value;
        img.parentNode.insertBefore(input, img);
        input.addEventListener('change',function () {
            users.data[name].value = this.value;
            users.save(function() {
                userColorSheet.textContent = '';
                users.load(users.data);
            });
        });
        return;
    }
    if (node.classList && node.classList.contains('user-container') && !node.classList.contains('present-user')) {
        var user = node.querySelector('a .username').textContent,
            existing = users.lookup(user);
        if (!existing && node.className) {
            var keys = node.className.match(/user-[0-9]+/g);
            if (keys) {
                users.store(user, keys[0], colorCode(hashCode(user + keys[0] + user)));
            }
        }
    }
}

function visualHexColors(node) {
    if (node.classList && node.classList.contains('message') && !node.classList.contains('pending') && !node.querySelector('.ob-post')) {
        [].forEach.call(node.childNodes, function(child) {
            if (child.parentNode.tagName === 'PRE') return;
            var re = /\B#(?:[0-9a-f]{3}){1,2}\b/ig;
            if (re.test(child.textContent)) {
                // ummm.. 
                child.innerHTML = child.innerHTML.replace(re, function(match) {
                    var temp = '<span style="border-bottom:solid 3px COL;">COL</span>';

                    return temp.replace(/COL/g, match);
                });
            }
        });
    }
}

function webmOnebox(node) {
    if (node.classList && node.classList.contains('message') && !node.classList.contains('pending')) {
        var content = node.querySelector('.content');
        if ( [].filter.call(content.childNodes, function (child) {
            return (child.nodeType === 1 || child.nodeType === 3);
        }).length > 1 ) return; // shut up
        var link = content.querySelector('a');
        if( !link || !/(webm|gifv)$/.test(link.href) ) return;
        var video = document.createElement('video');
        video.controls = true;
        video.src = link.href.replace(/(gifv)$/,'webm');
        video.width = 320;
        video.height = 240;
        link.parentNode.replaceChild(video, link);
    }
}

function parseNode(node) {
    colorUsers(node);
    visualHexColors(node);
    if( options.webm ) {
        webmOnebox(node);
    }
}

function randomColor() {
    return '#' + Math.random().toString(16).slice(-6);
}

function init(colorUsersData){
    document.head.appendChild(userColorSheet);
    users.load(colorUsersData);

    setTimeout(function() {
        // this is where I just get lazy
        [].forEach.call(chat.querySelectorAll('.user-container'), colorUsers);
        [].forEach.call(chat.querySelectorAll('.user-container .message'), visualHexColors);
        if( options.webm ) {
            [].forEach.call(chat.querySelectorAll('.user-container .message'), webmOnebox);
        }
        users.save();
    }, 1000); // some users are never parsed. this solves that.

    new MutationObserver(function(records) {
        records.forEach(function(record) {
            [].forEach.call(record.addedNodes, parseNode);
        });
    }).observe(document.body, {
        childList: true,
        subtree: true
    });

}