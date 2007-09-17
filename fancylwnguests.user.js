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
// @name          muzzleLWNGuests
// @namespace     http://proven-corporation.com/
// @description   Make guest postings on lwn.net hidden, but with a button to expose them if desired.
// @include       http://lwn.net/Articles/*
// ==/UserScript==

var drabCommentColor = 'lightgrey';

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
    var idFinder = /^http:\/\/lwn.net\/Articles\/(\d+)\//;
    var heading = getCommentHeading(comment);
    var url = heading.childNodes[3].href

    var result = idFinder.exec(url);
    if(result == null) {
        GM_log('Failed to find comment ID for url: ' + url);
        return null;
    }

    return result[1];
}

function makeDrab(comment) {
    getCommentTitle(comment).style.background = drabCommentColor;
    comment.style.borderColor = drabCommentColor;
}

function makeNormal(comment) {
    getCommentTitle(comment).style.background = null;
    comment.style.borderColor = null;
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

        /* Make the subject heading and comment text normal. */
        //makeNormal(comment);
        commentText.style.display = null;
    }
    else if(this.value == 'Hide') {
        this.value = 'View';

        /* Make the subject heading unattractive and hide the comment text. */
        //makeDrab(post);
        commentText.style.display = 'none';
    }
};

/* Make an LWN comment expandable/collapsable by adding a "Hide" button and putting the comment
 * text in a DIV so that it can be shown or hidden by the button.
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
    var displayButton   = document.createElement('input');
    displayButton.type  = 'button';
    displayButton.value = 'Hide';
    displayButton.addEventListener('click', handleClick, false);

    var commentHeading = getCommentHeading(comment);
    commentHeading.appendChild(displayButton);

    return displayButton;
}

var guestFinder = /(Posted .* by guest )/;

/* Loop through all comments and make them dynamic. */
var comments = document.evaluate("//div[@class='CommentBox']", document, null,
                                 XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
for(var a = 0; a < comments.snapshotLength; a++) {
    var comment = comments.snapshotItem(a);
    var hideButton = makeDynamic(comment);

    var id = getCommentId(comment);
    GM_setValue('seen-' + id, true);

    /* Guest comments get a drab color and collapse. */
    var commentHeading = getCommentHeading(comment);
    var result = guestFinder.exec(commentHeading.textContent);
    if(result) {
        makeDrab(comment);

        /* Click the collapse button. */
        var e = document.createEvent('MouseEvents');
        e.initMouseEvent('click', true, true, window,
            0, 0, 0, 0, 0, false, false, false, false, 0, null);
        hideButton.dispatchEvent(e);
    }
}
