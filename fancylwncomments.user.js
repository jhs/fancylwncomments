/*
 * Copyright 2007-2008 Proven Corporation Co., Ltd., Thailand
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
// @description   Improved comment UI in lwn.net: ignore guests and previously-read posts, with color coding.
// @include       http://lwn.net/Articles/*
// ==/UserScript==

/* Feel free to modify these two sets of configuration settings. */

/* Colors for each type of comment */
var colors = {
    'guest read'    : GM_getValue('guest read'   , '#ccff99'),
    'guest unread'  : GM_getValue('guest unread' , '#99ff99'),
    'member read'   : GM_getValue('member read'  , '#ffff99'),
    'member unread' : GM_getValue('member unread', '#ffcc99'),
};

/* UI behavior options */
var switches = {
    'hide guest'  : GM_getValue('hide guest'  , false),
    'hide read'   : GM_getValue('hide read'   , false),
    'full hilight': GM_getValue('full hilight', false),
};

/*
 * =-=-=-=-=-=-= No more user-configurable settings below this line =-=-=-=-=-=-=
 */

/* "Constants" */
var PLUS = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAABmJLR0QA%2FwD%2FAP%2BgvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH1wkTCwQhqAMmjAAAADZJREFUGNNjbGho%2BM9ACBBS1NDQ8J8JiziGJiYGIgALDhNgbEZ0RYxIChhJtg6bIkYMAWLCCQC%2FUA4P3D7t2wAAAABJRU5ErkJggg%3D%3D';
var MINUS = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAABmJLR0QA%2FwD%2FAP%2BgvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH1wkTCwcVopqB%2BgAAAC5JREFUGNNjbGho%2BM9ACBBS1NDQ8J%2BJgQhAlCIWJDY2axnRFTFSZB1RihiJCScAsJALEOLrEQYAAAAASUVORK5CYII%3D';


/* Conveniently search via XPath.  If nothing matches,
 * return null.  For one match, return the element.  For multiple matches,
 * return an array of elements.  The forceList option will force the
 * function to return a list, regardless of the result.
 */
function xpath(path, forceList, node) {
    if(forceList === undefined)
        forceList = false;
    if(node === undefined)
        node = document

    var result = [];
    var nodes = document.evaluate(path, node, null,
                                  XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null );
    for(var a = 0; a < nodes.snapshotLength; a++)
        result.push(nodes.snapshotItem(a));
    if(forceList)
        return result;

    if(result.length == 0)
        return null;
    else if(result.length == 1)
        return result[0];
    else
        return result;
}

/* Simulate a click on a node. */
function click(node) {
    var e = document.createEvent('MouseEvents');
    e.initMouseEvent('click', true, true, window,
        0, 0, 0, 0, 0, false, false, false, false, 0, null);
    node.dispatchEvent(e);
}

/* Regular expressions used in the script */
var guestFinder = /(Posted .* by .* \(guest, )/;
var idFinder    = /^http:\/\/lwn.net\/Articles\/(\d+)\//;

/* XXX
 * These functions are somewhat hard-coded and heavily dependent on the HTML
 * coming from the site.  If the DOM tree of the site changes, they may need
 * to be updated.
 * XXX
 */
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

function getCommentText(comment) {
    /* XXX: This function only works on comments already processed by makeDynamic(). */
    var body = getCommentBody(comment);
    return body.childNodes[2];
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

/* Return whether a particular comment ID has been marked as read. */
function isCommentSeen(comment) {
    var id = getCommentId(comment);
    return GM_getValue('read-' + id, false);
}

/* Return whether a particular comment (the DOM node, not the ID) is from a guest. */
function isCommentGuest(comment) {
    var result = guestFinder.exec(getCommentHeading(comment).textContent);
    if(result == null)
        return false;
    return true;
}

/* Return whether a particular comment (the DOM node, not the ID) is visible. */
function isCommentVisible(comment) {
    return (getCommentText(comment).style.display == "")
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

    /* XXX: This may need updating if the site's HTML changes too much. */
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

/* Prepare an LWN comment to be ready for manipulation.  This will rearrange the DOM a little
 * to put the comment body in its own DIV and add a View/Hide button.
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
    hideButton.className = 'commentToggler';
    hideButton.addEventListener('click', handleClick, false);

    var commentHeading = getCommentHeading(comment);
    commentHeading.appendChild(hideButton);
}

/* Look at a comment and decide whether it is from a guest or normal member, and whether
 * it has been seen already.  Set the colors and view/hide state accordingly.
 */
function evaluateComment(comment, colorOnly) {
    var commentBody = getCommentBody(comment);
    var commentText = getCommentText(comment);
    var read  = isCommentSeen(comment);
    var guest = isCommentGuest(comment);
    var visible = isCommentVisible(comment);

    if(colorOnly === undefined)
        colorOnly = false;

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
    if(switches['full hilight'])
        commentBody.style.background = color;
    else
        commentBody.style.background = null;

    if(colorOnly)
        return;

    if((switches['hide guest'] && guest) || (switches['hide read'] && read)) {
        /* The comment should be hidden. */
        var hideButton = xpath('*//input[@value="Hide"]', false, comment);
        if(hideButton)
            /* Make a visible comment hidden. */
            click(hideButton);
    }
    else {
        /* The comment should be visible. */
        var viewButton = xpath('*//input[@value="View"]', false, comment);
        if(viewButton)
            /* Make a hidden comment visible. */
            click(viewButton);
    }
}

function evaluateAll(colorOnly) {
    /* Evaluate all comments (comment must be initialized first). */
    var comments = xpath('//div[@class="CommentBox"]', true);
    for(var a in comments)
        evaluateComment(comments[a], colorOnly);
};

/* Set the colors in the color boxes in the config panel to indicate what each color of hilighting represents. */
function setColorBoxes() {
    var changeColor = function(ev) {
        /* Bring up a prompt to change a color setting. */
        var editorID = 'set ' + ev.target.id;
        var editor   = document.getElementById(editorID);
        editor.innerHTML = 'jason is cool';
        editor.style.display = null;
    };

    for(var postType in colors) {
        var node = document.getElementById(postType);
        node.style.background = colors[postType];

        node.addEventListener('click', changeColor, false);
    }
};

/* This is the main program entry after the page loads completely. */
function main() {
    /* Add the config section after the "Logged in as..." stuff. */
    var sideBox = xpath('//div[@class="SideBox"][1]');
    if(!sideBox) {
        /* TODO disable this script because it seems to fail to work with the site's HTML. */
        return;
    }
    else {
        var colorBoxStyle = 'position: absolute; right: 0; cursor: pointer; border: 1px solid black; width: 1em; height: 1em';
        var colorConfigStyle = 'display: none; position: absolute; left: 150px; bottom: 90px; width: 200px;';

        var configBox = document.createElement('div');
        configBox.className = 'SideBox';
        configBox.innerHTML =
            '<p style="cursor: pointer" id="commentLabel" class="Header">' +
            '<img id="commentExpander" src="'+ PLUS +'" />' +
            ' Comments' +
            '</p>' +
            '<div id="commentSettings" style="position: relative; padding-left: 1em; display: none">' +
             '<p>' +
              '<label for="hide guest">Hide guests</label>' +
              '<input type="checkbox" id="hide guest" style="position: absolute; right: 0" />' +
             '</p>' +
             '<p>' +
              '<label for="hide read">Hide read</label>' +
              '<input type="checkbox" id="hide read" style="position: absolute; right: 0" />' +
             '</p>' +
             '<p>' +
              '<label for="full hilight">More hilighting</label>' +
              '<input type="checkbox" id="full hilight" style="position: absolute; right: 0" />' +
             '</p>' +
             '<p>' +
              'Unread member' +
              '<a id="member unread" style="' + colorBoxStyle + '"></a>'+
             '</p>' +
             '<p>' +
              'Read member' +
              '<a id="member read" style="' + colorBoxStyle + '"></a>'+
             '</p>' +
             '<p>' +
              'Unread guest' +
              '<a id="guest unread" style="' + colorBoxStyle + '"></a>'+
             '</p>' +
             '<p>' +
              'Read guest' +
              '<a id="guest read" style="' + colorBoxStyle + '"></a>' + 
             '</p>' +
             '<div id="set guest read" style="' + colorConfigStyle + '"></div>' +
             '<p style="text-indent: 0px; margin: 0px;">' +
              '<input type="button" id="expandAll" value="Expand All" style="margin-bottom: 2px; width: 100%" />' +
             '</p>' +
             '<p style="text-indent: 0px; margin: 0px;">' +
              '<input type="button" id="hideAll" value="Hide All" style="margin-bottom: 2px; width: 100%" />' +
             '</p>' +
             '<p style="text-indent: 0px; margin: 0px;">' +
              '<input type="button" id="markRead" value="Mark all Read" style="margin-bottom: 2px; width: 100%" />' +
             '</p>' +
             '<p style="text-indent: 0px; margin: 0px;">' +
              '<input type="button" id="markUnread" value="Mark all Unread" style="margin-bottom: 2px; width: 100%" />' +
             '</p>' +
            '</div>';

        /* Attach this into the DOM tree after the first sidebox. */
        sideBox.parentNode.insertBefore(configBox, sideBox.nextSibling);

        /* Do the boolean options (switches) */
        for(var optName in switches) {
            var box = document.getElementById(optName);
            box.checked = switches[optName];
            box.addEventListener('change', function(ev) {
                GM_setValue(this.id, this.checked);
                switches[this.id] = this.checked;
                var colorOnly = false;
                if(this.id == 'full hilight')
                    colorOnly = true;
                evaluateAll(colorOnly);
            }, false);
        }

        /* Do the color boxes. */
        setColorBoxes();

        /* The expand all button opens all currently hidden comments. */
        document.getElementById('expandAll').addEventListener('click', function(ev) {
            var buttons = xpath('//input[@class="commentToggler"][@value="View"]', true);
            for(var a in buttons)
                click(buttons[a]);
        }, false);

        /* The collapse all button hides all currently open comments. */
        document.getElementById('hideAll').addEventListener('click', function(ev) {
            var buttons = xpath('//input[@class="commentToggler"][@value="Hide"]', true);
            for(var a in buttons)
                click(buttons[a]);
        }, false);

        /* Do the mark read button. */
        document.getElementById('markRead').addEventListener('click', function(ev) {
            var comments = xpath('//div[@class="CommentBox"]', true);
            for(var a in comments)
                GM_setValue('read-' + getCommentId(comments[a]), true);
            evaluateAll(true);
        }, false);

        /* Do the mark read button. */
        document.getElementById('markUnread').addEventListener('click', function(ev) {
            var comments = xpath('//div[@class="CommentBox"]', true);
            for(var a in comments)
                GM_setValue('read-' + getCommentId(comments[a]), false);
            evaluateAll(true);
        }, false);

        var label    = document.getElementById('commentLabel')
        var expander = document.getElementById('commentExpander');
        var toggleViewable = function(ev) {
            var commentBox = document.getElementById('commentSettings');
            if(expander.src == PLUS) {
                /* Open the config panel. */
                commentBox.style.display = null;
                expander.src = MINUS;
                GM_setValue('widget open', true);
            }
            else if(expander.src == MINUS) {
                /* Close the config panel. */
                commentBox.style.display = 'none';
                expander.src = PLUS;
                GM_setValue('widget open', false);
            }
        };

        label.addEventListener('click', toggleViewable, false);
        if(GM_getValue('widget open', false))
            /* Start in the open state. */
            toggleViewable();
    }

    /* Loop through all comments and make them dynamic. */
    var comments = xpath('//div[@class="CommentBox"]', true);
    for(var a = 0; a < comments.length; a++) {
        var comment = comments[a];
        makeDynamic(comment);
        evaluateComment(comment);
        /* No longer setting articles as read by default. */
        //GM_setValue('read-' + getCommentId(comment), true);
    }
}

window.addEventListener('load', main, true);
