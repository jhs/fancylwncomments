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
// @description   Make guest postings on lwn.net hidden, but with a button to expose them if desired.
// @include       http://lwn.net/Articles/*
// @include       http://www.lwn.net/Articles/*
// ==/UserScript==

var drabHeadingColor = 'lightgrey';

/* Make a LWN comment's subject heading drab and unattractive.  This function requires being passed the
 * <td> with the actual comment text inside, and it will find the heading itself.  (This will be
 * convenient for the code below.)
 */
function makeDrab(node) {
    node.parentNode.parentNode.parentNode.parentNode.childNodes[1].style.background = drabHeadingColor;
}

function makeNormal(node) {
    node.parentNode.parentNode.parentNode.parentNode.childNodes[1].style.background = null;
}

/* Handle the clicking of the "View" button in guest comments (or "Hide" button if it was
 * already clicked before -- it's a toggle).  The "this" variable is therefore bound to the
 * <input> button.  Since a button was conveniently embedded in each comment, just
 * walk up the DOM ancestry to the actual comments and make them visible/invisible or
 * attractive/unattractive as appropriate.
 */
var handleClick = function(event) {
    var commentMetadata = this.parentNode;
    var commentBody     = commentMetadata.parentNode.nextSibling;

    /* Either display or un-display the comment. */
    if(this.value == 'View') {
        this.value = 'Hide';

        /* Make the subject heading and comment text normal. */
        makeNormal(commentMetadata);
        commentBody.style.display = null;
    }
    else if(this.value == 'Hide') {
        this.value = 'View';

        /* Make the subject heading unattractive and hide the comment text. */
        makeDrab(commentMetadata);
        commentBody.style.display = 'none';
    }
};

/* Loop through all comments, find the ones posted by guests. */
var comments = document.evaluate("//td[@class='CommentBody']", document, null,
                                 XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
var guestFinder = /(Posted .* by guest $)/;
for(var a = 0; a < comments.snapshotLength; a++) {
    var node = comments.snapshotItem(a);

    var commentHeading = node.childNodes[0];
    var result = guestFinder.exec(commentHeading.nodeValue);
    if(result) {
        makeDrab(node);

        /* XXX Kludge XXX:
         * Convert this comment table into to two rows.  The top row has the permanent "Posted by so-and-so" info,
         * and the bottom row has the actual post.  This causes a small bug as there is more margin between
         * the two lines than in normal comments, but it is not noticeable in normal usage, and separating the
         * comment into two rows makes it easy to hide one of them.
         */
        var topRow         = node.parentNode;
        var commentTable   = topRow.parentNode;
        var bottomRow      = document.createElement('tr');
        var bottomTD       = document.createElement('td');
        bottomTD.className = 'CommentBody';
        bottomRow.appendChild(bottomTD);

        /* AFAIK, it is nessary to make an array of child nodes since the childNode attribute is not really
         * a list.  Modifying child nodes while iterating through childNodes is supposed to be buggy.
         * Also, start from 5 because 0-4 is the "Posted by so-and-so" stuff that should stay put.
         */
        var nodesToMove = [];
        for(var i = 5; i < node.childNodes.length; i++) {
            nodesToMove.push(node.childNodes[i]);
        }

        /* Perform the actual movement from the original top (and only) row to the bottom row. */
        for(var i = 0; i < nodesToMove.length; i++) {
            node.removeChild(nodesToMove[i]);
            bottomTD.appendChild(nodesToMove[i]);
        }

        /* Finally, hide the bottom row with the guest's comment. */
        bottomRow.style.display = 'none';

        commentTable.appendChild(bottomRow);

        /* Make the button. */
        var displayButton   = document.createElement('input');
        displayButton.type  = 'button';
        displayButton.value = 'View';
        displayButton.addEventListener('click', handleClick, false);

        node.appendChild(displayButton);
    }
}
