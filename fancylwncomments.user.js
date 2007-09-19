/*
 * Copyright 2007 Proven Corporation Co., Ltd., Thailand
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; version 2 dated June, 1991.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
*/

// ==UserScript==
// @name          fancyLWNComments
// @namespace     http://proven-corporation.com/
// @description   Make guest and already-seen comments on lwn.net hidden.
// @include       http://lwn.net/Articles/*
// ==/UserScript==

var colors = {
    'guest read'    : GM_getValue('guest read'   , '#ccff99'),
    'guest unread'  : GM_getValue('guest unread' , '#99ff99'),
    'member read'   : GM_getValue('member read'  , '#ffff99'),
    'member unread' : GM_getValue('member unread', '#ffcc99'),
};

var hideGuest   = GM_getValue('hide guest'  , true);
var hideRead    = GM_getValue('hide read'   , true);
var fullHilight = GM_getValue('full hilight', false);

/* "Constants" */
var PLUS = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAABmJLR0QA%2FwD%2FAP%2BgvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH1wkTCwQhqAMmjAAAADZJREFUGNNjbGho%2BM9ACBBS1NDQ8J8JiziGJiYGIgALDhNgbEZ0RYxIChhJtg6bIkYMAWLCCQC%2FUA4P3D7t2wAAAABJRU5ErkJggg%3D%3D';
var MINUS = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAABmJLR0QA%2FwD%2FAP%2BgvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH1wkTCwcVopqB%2BgAAAC5JREFUGNNjbGho%2BM9ACBBS1NDQ8J%2BJgQhAlCIWJDY2axnRFTFSZB1RihiJCScAsJALEOLrEQYAAAAASUVORK5CYII%3D';


/* Conveniently search via XPath.  The optional second argument is a node
 * to search within (defaults to the whole document.)  If nothing matches,
 * return null.  For one match, return the element.  For multiple matches,
 * return an array of elements.
 */
function xpath(path, node) {
    if(node === undefined)
        node = document;

    var nodes = document.evaluate(path, node, null,
                                  XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null );

    if(nodes.snapshotLength == 0)
        return null;
    else if(nodes.snapshotLength == 1)
        return nodes.snapshotItem(0);
    else {
        var result = [];
        for(var a = 0; a < nodes.snapshotLength; a++)
            result.push(nodes.snapshotItem(a));
        return result;
    }
}

/* Regular expressions used in the script */
var guestFinder = /(Posted .* by guest )/;
var idFinder    = /^http:\/\/lwn.net\/Articles\/(\d+)\//;

/* These functions are sort of hard-coded and could change if the HTML of the site changes. */
function getCommentTitle(comment) {
    return comment.childNodes[1];
}

function getCommentBody(comment) {
    return comment.childNodes[3];
}

function getCommentHeading(comment) {
    var body = getCommentBody(comment);
    return body.childNodes[1];
}

function getCommentId(comment) {
    var heading = getCommentHeading(comment);
    var url = heading.childNodes[3].href

    var result = idFinder.exec(url);
    if(result == null) {
        GM_log('Failed to find comment ID for url: ' + url);
        return null;
    }

    return result[1];
}

function isCommentSeen(comment) {
    var id = getCommentId(comment);
    return GM_getValue('read-' + id, false);
}

function isCommentGuest(comment) {
    var result = guestFinder.exec(getCommentHeading(comment).textContent);
    if(result == null)
        return false;
    return true;
}

/* Handle the clicking of the "View" button in guest comments (or "Hide" button if it was
 * already clicked before -- it's a toggle).  The "this" variable is therefore bound to the
 * <input> button.  Since a button was conveniently embedded in each comment, just
 * walk up the DOM ancestry to the actual comments and make them visible/invisible or
 * attractive/unattractive as appropriate.
 */
var handleClick = function(ev) {
    var comment        = this.parentNode.parentNode.parentNode;
    var commentBody    = getCommentBody(comment);
    var commentText    = commentBody.childNodes[2];

    /* Either display or un-display the comment. */
    if(this.value == 'View') {
        this.value = 'Hide';
        commentText.style.display = null;
    }
    else if(this.value == 'Hide') {
        this.value = 'View';
        commentText.style.display = 'none';
    }
};

/* Make an LWN comment use the color based on who posted it and whether we've seen it already.
 * Also make it expand/collapse with a "Hide" button.  All previously-seen posts and guest
 * posts are automatically collapsed.
 */
function makeDynamic(comment) {
    var commentBody = getCommentBody(comment);

    /* All comment text goes in its own compartment so it can be hidden later. */
    var commentText = document.createElement('div');

    /* Move everything under the CommentPoster paragraph (i.e. "Posted by ...") to the compartment. */
    var nodesToMove = [];
    for(var a = 2; a < commentBody.childNodes.length; a++)
        nodesToMove.push(commentBody.childNodes[a]);

    for(var a = 0; a < nodesToMove.length; a++) {
        commentBody.removeChild(nodesToMove[a]);
        commentText.appendChild(nodesToMove[a]);
    }

    commentBody.appendChild(commentText);
    commentText.style.display = null;

    /* Make the button. */
    var hideButton   = document.createElement('input');
    hideButton.type  = 'button';
    hideButton.value = 'Hide';
    hideButton.addEventListener('click', handleClick, false);

    var commentHeading = getCommentHeading(comment);
    commentHeading.appendChild(hideButton);

    var read  = isCommentSeen(comment);
    var guest = isCommentGuest(comment);

    var postType;
    if(guest)
        postType = 'guest ';
    else
        postType = 'member ';
    if(read)
        postType += 'read';
    else
        postType += 'unread';

    var color = colors[postType];
    getCommentTitle(comment).style.background = color;
    comment.style.borderColor = color;
    if(fullHilight)
        commentBody.style.background = color;

    if((hideGuest && guest) || (hideRead && read)) {
        /* Click the collapse button. */
        var e = document.createEvent('MouseEvents');
        e.initMouseEvent('click', true, true, window,
            0, 0, 0, 0, 0, false, false, false, false, 0, null);
        hideButton.dispatchEvent(e);
    }

    if(!read)
        GM_setValue('read-' + getCommentId(comment), true);
}

/* This is the main program entry after the page loads completely. */
function main() {
    /* Add the config section after the "Logged in as..." stuff. */
    var sideBox = xpath('//div[@class="SideBox"][1]');
    if(!sideBox) {
        /* TODO disable this script because it seems to fail to work with the site's HTML. */
        return;
    }
    else {
        var configBox = document.createElement('div');
        configBox.className = 'SideBox';
        configBox.innerHTML =
            '<p class="Header">' +
            '<img style="cursor: pointer" id="commentExpander" src="'+ PLUS +'" />' +
            ' Comments' +
            '</p>' +
            '<div id="commentSettings" style="position: relative; padding-left: 1em; display: none">' +
             '<p>' +
              '<label for="hideGuest">Hide guests</label>' +
              '<input type="checkbox" id="hideGuest" name="hideGuest" style="position: absolute; right: 0" />' +
             '</p>' +
             '<p>' +
              '<label for="hideRead">Hide read</label>' +
              '<input type="checkbox" id="hideRead" name="hideRead" style="position: absolute; right: 0" />' +
             '</p>' +
             '<p>' +
              '<label for="fullHilight">More hilighting</label>' +
              '<input type="checkbox" id="fullHilight" name="fullHilight" style="position: absolute; right: 0" />' +
             '</p>' +
             '<p>' +
              'Unread member' +
              '<a id="member unread" style="position: absolute; right: 0; cursor: pointer; border: 1px solid black; width: 1em; height: 1em"></a>'+
             '</p>' +
             '<p>' +
              'Read member' +
              '<a id="member read" style="position: absolute; right: 0; cursor: pointer; border: 1px solid black; width: 1em; height: 1em"></a>'+
             '</p>' +
             '<p>' +
              'Unread guest' +
              '<a id="guest unread" style="position: absolute; right: 0; cursor: pointer; border: 1px solid black; width: 1em; height: 1em"></a>'+
             '</p>' +
             '<p>' +
              'Read guest' +
              '<a id="guest read" style="position: absolute; right: 0; cursor: pointer; border: 1px solid black; width: 1em; height: 1em"></a>'+
             '</p>' +
            '</div>';

        /* Attach this into the DOM tree after the first sidebox. */
        sideBox.parentNode.insertBefore(configBox, sideBox.nextSibling);

        /* Set the values to match the settings. */
        document.getElementById('hideGuest').checked   = hideGuest;
        document.getElementById('hideRead').checked    = hideRead;
        document.getElementById('fullHilight').checked = fullHilight;

        for(var postType in colors) {
            var node = document.getElementById(postType);
            node.style.background = colors[postType];
        }

        var expander = document.getElementById('commentExpander');
        expander.state = 'closed';
        expander.addEventListener('click', function(ev) {
            var commentBox = document.getElementById('commentSettings');
            if(this.src == PLUS) {
                /* Open the config panel. */
                commentBox.style.display = null;
                this.src = MINUS;
            }
            else if(this.src == MINUS) {
                /* Close the config panel. */
                commentBox.style.display = 'none';
                this.src = PLUS;
            }
        }, false);
    }

    /* Loop through all comments and make them dynamic. */
    var comments = xpath('//div[@class="CommentBox"]');
    for(var a = 0; a < comments.length; a++)
        makeDynamic(comments[a]);
}

window.addEventListener('load', main, true);
