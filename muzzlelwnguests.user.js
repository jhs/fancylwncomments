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

var drabHeadingColor = 'lightgrey';

/* Make a LWN comment's subject heading drab and unattractive.  This function requires being passed the
 * DIV with the actual comment text inside, and it will find the heading itself.  (This will be
 * convenient for the code below.)
 */
function makeDrab(node) {
    node.parentNode.childNodes[1].style.background = drabHeadingColor;
}

function makeNormal(node) {
    node.parentNode.childNodes[1].style.background = null;
}

/* Handle the clicking of the "View" button in guest comments (or "Hide" button if it was
 * already clicked before -- it's a toggle).  The "this" variable is therefore bound to the
 * <input> button.  Since a button was conveniently embedded in each comment, just
 * walk up the DOM ancestry to the actual comments and make them visible/invisible or
 * attractive/unattractive as appropriate.
 */
var handleClick = function(event) {
    var commentHeading = this.parentNode;
    var commentBody    = commentHeading.nextSibling;
    var post           = commentHeading.parentNode;

    /* Either display or un-display the comment. */
    if(this.value == 'View') {
        this.value = 'Hide';

        /* Make the subject heading and comment text normal. */
        makeNormal(post);
        commentBody.style.display = null;
    }
    else if(this.value == 'Hide') {
        this.value = 'View';

        /* Make the subject heading unattractive and hide the comment text. */
        makeDrab(post);
        commentBody.style.display = 'none';
    }
};

/* Loop through all comments, find the ones posted by guests. */
var comments = document.evaluate("//div[@class='CommentBody']", document, null,
                                 XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
var guestFinder = /(Posted .* by guest $)/;
for(var a = 0; a < comments.snapshotLength; a++) {
    var post = comments.snapshotItem(a);

    var commentHeading = post.childNodes[1];
    var result = guestFinder.exec(commentHeading.childNodes[0].nodeValue);
    if(result) {
        makeDrab(post);

        /* Put the remainder of the comment (under the "Posted by so-and-so" part) into its own DIV
         * so that it can be handled all at once.
         */
        var postBody = document.createElement('div');

        /* Move the stuff under the "Posted by..." paragraph inside the div.  I heard a rumor that modifying
         * childNodes while iterating through it is bad, so do this the hard way.
         */
        var nodesToMove = [];
        for(var i = 2; i < post.childNodes.length; i++) {
            nodesToMove.push(post.childNodes[i]);
        }

        /* Perform the relocation. */
        for(var i = 0; i < nodesToMove.length; i++) {
            post.removeChild(nodesToMove[i]);
            postBody.appendChild(nodesToMove[i]);
        }

        postBody.style.display = 'none';
        post.appendChild(postBody);

        /* Make the button. */
        var displayButton   = document.createElement('input');
        displayButton.type  = 'button';
        displayButton.value = 'View';
        displayButton.addEventListener('click', handleClick, false);

        commentHeading.appendChild(displayButton);
    }
}
