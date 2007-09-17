/*
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
// @description   Make guest postings on lwn.net hidden, but with a button to expose them if desired.
// @include       http://lwn.net/Articles/*
// ==/UserScript==

/* Regular expressions used in the script */
var guestFinder = /(Posted .* by guest )/;
var idFinder    = /^http:\/\/lwn.net\/Articles\/(\d+)\//;

/* Comments can be seen/unseen, and by guest/subscriber. */
var commentColors = {true: {}, false: {}};
/* Key:       guest / seen */
commentColors[true]  [true]  = '#ccff99';
commentColors[true]  [false] = '#99ff99';
commentColors[false] [true]  = '#ffff99';
commentColors[false] [false] = '#ffcc99';

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
    return GM_getValue('seen-' + id, false);
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
var handleClick = function(event) {
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

    var seen  = isCommentSeen(comment);
    var guest = isCommentGuest(comment);
    var color = commentColors[guest][seen];

    getCommentTitle(comment).style.background = color;
    comment.style.borderColor = color;

    if(seen || guest) {
        /* Click the collapse button. */
        var e = document.createEvent('MouseEvents');
        e.initMouseEvent('click', true, true, window,
            0, 0, 0, 0, 0, false, false, false, false, 0, null);
        hideButton.dispatchEvent(e);
    }

    if(!seen)
        GM_setValue('seen-' + getCommentId(comment), true);
}

/* Loop through all comments and make them dynamic. */
var comments = document.evaluate("//div[@class='CommentBox']", document, null,
                                 XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);

for(var a = 0; a < comments.snapshotLength; a++) {
    var comment = comments.snapshotItem(a);
    makeDynamic(comment);
}
