function Hexmash (toolbarItems, loadingItems, viewerItems) {
    this.buffer = null;     // The file buffer
    this.chunkSize = 10240; // The number of bytes to load into the viewer at a time
    this.currentLoadOffset = 0;
    this.dropzoneScrollOffset = 10;

    this.toolbarItems = toolbarItems;
    this.loadingItems = loadingItems;
    this.viewerItems  = viewerItems;

    // Hookup tools
    this.toolbarItems.openTool.addEventListener("click", this.loadingItems.fileBrowser.click.bind(this.loadingItems.fileBrowser), false);
    this.toolbarItems.topTool.addEventListener("click", this.scrollToTop.bind(this), false);

    // Hookup drag and drop
    this.makeDropable(this.loadingItems.dropzoneDiv);
    this.makeDropable(this.toolbarItems.openTool);

    // Hookup the hovering
    this.currentHexHighlight = {
        row: null,
        column: null,
        originalHtml: null
    };
    this.currentRawHighlight = {
        row: null,
        column: null,
        originalHtml: null
    };
    this.viewerItems.hexValue.addEventListener("mousemove", this.byteHover.bind(this));
    this.viewerItems.rawValue.addEventListener("mousemove", this.byteHover.bind(this));

    // Hookup the browser and link using the hidden file browser
    this.loadingItems.fileBrowser.addEventListener("change", this.onFileChange.bind(this), false);
    this.loadingItems.browseLink.addEventListener("click", this.loadingItems.fileBrowser.click.bind(this.loadingItems.fileBrowser), false);

    // Hookup the scroll events (progressive loading and show/hide the dropzone)
    document.addEventListener("scroll", function(evt) {
        // If there is more to load and the user is 1 screen away from the bottom, start loading the next chunk
        if (this.buffer !== null && document.body.scrollHeight - window.scrollY < window.innerHeight * 2 
            && this.currentLoadOffset < this.buffer.byteLength) {
            this.continueLoading();
        }

        // Only show/hide if it all can't fit in the view
        if (document.body.scrollHeight - this.loadingItems.dropzoneDiv.offsetHeight > window.innerHeight) {
            if ((window.scrollY > this.dropzoneScrollOffset && this.dropzoneVisible()) || (window.scrollY < this.dropzoneScrollOffset && !this.dropzoneVisible())) {
                this.showHideDropzone();
            }
        }
    }.bind(this));

    // Setup the reader
    this.reader = new FileReader()
    this.reader.onload = this.readerLoaded.bind(this);
    this.reader.onprogress = this.readerProgress.bind(this);
}

/*
* Handle hovering over either the hex or the raw output of a byte
*/
Hexmash.prototype.byteHover = function(evt) {
    var target = evt.target;
    var row = null;

    // Get the row number from the ID if a hex or raw row are the target
    if (target.classList.contains('hex_row')) {
        row = parseInt(target.id.replace('hex', ''));
    }
    else if (target.classList.contains('raw_row')) {
        row = parseInt(target.id.replace('raw', ''));
    }

    if (row !== null) {
        // Calculate the offset - evt.offsetX doesn't appear to be reliable in chrome
        var pointerOffsetX = evt.clientX - target.offsetLeft;

        // Get the target character in the row
        var rowCharacterCount = target.textContent.length;
        var columnCharacterCount = rowCharacterCount / 16;
        var characterWidth = target.offsetWidth / rowCharacterCount;

        var targetCharacter =  Math.floor(pointerOffsetX / characterWidth);

        /* Ignore spacing characters (at the end of the column for the first half of the row
        *  and beginning of the column for the second)
        *  e.g. 3 characters for hex:
        *       the first half  - "ff ", skip the space at index 2
        *       the second half - " ff", skip the space at index 0
        */
        if ((targetCharacter < rowCharacterCount / 2 && (targetCharacter +  1) % columnCharacterCount !== 0) 
            ||(targetCharacter > rowCharacterCount / 2 && targetCharacter % columnCharacterCount !== 0)) {
            var column = Math.floor(targetCharacter / columnCharacterCount);

            var hexRow = document.getElementById('hex' + row);
            var rawRow = document.getElementById('raw' + row);

            // Highlight both the corresponding hex and text for the byte
            this.highlightByte(hexRow, column, 2, this.currentHexHighlight, 'hex_cell_highlighted');
            this.highlightByte(rawRow, column, 1, this.currentRawHighlight, 'raw_cell_highlighted');
            this.updateOffsetStatus(row + column);
        }
    }
};


/*
* Highlight either the hex or the raw output of a byte
*/
Hexmash.prototype.highlightByte = function(row, column, byteWidth, tracker, highlightClass) {
    // Get the position of the text
    var offsetStart = column * (byteWidth + 1);
    if (column > 7) offsetStart++; // Handle double space divider
    var offsetEnd = offsetStart + byteWidth;

    // Clear the previous
    if (tracker.row !== null) {
        tracker.row.innerHTML = tracker.originalHtml;
    }

    // The highlighting is done by wrapping the bytes characteres in a span
    var originalHtml = row.textContent;
    var updatedHtml = originalHtml.substring(0, offsetStart);
    updatedHtml += '<span class="' + highlightClass + '">' + originalHtml.substring(offsetStart, offsetEnd);
    updatedHtml += '</span>' + originalHtml.substring(offsetEnd);
    row.innerHTML = updatedHtml;

    // Track the highlighting information
    tracker.row = row;
    tracker.column = column;
    tracker.originalHtml = originalHtml;
};

/*
* Display offset of the hilighted byte in the toolbar
*/
Hexmash.prototype.updateOffsetStatus = function(offset) {
    this.toolbarItems.offset.innerHTML = offset;
};

/*
* File reader progress event
*/
Hexmash.prototype.readerProgress = function(evt) {
    var progress = evt.loaded / evt.total;
    // TODO: Show progress
    console.log(progress);
}

/*
* File reader load event - pass the result buffer to be loaded
*/
Hexmash.prototype.readerLoaded = function(evt) {
    this.buffer = evt.target.result;
    this.currentLoadOffset = 0;
    this.loadBuffer(this.buffer, 0, this.chunkSize);

    window.scrollTo(window.scrollX, this.dropzoneScrollOffset + 1);
}

/*
* Load the next chunk of the file into the viewer
*/
Hexmash.prototype.continueLoading = function(evt) {
    this.loadBuffer(this.buffer, this.currentLoadOffset, this.chunkSize);
}

/*
* Take a buffer and load it into the viewer
*/
Hexmash.prototype.loadBuffer = function(buffer, startOffset, length) {
    var bytes = new Uint8Array(buffer);

    var offsetHolder = document.createDocumentFragment();
    var hexHolder = document.createDocumentFragment();
    var rawHolder = document.createDocumentFragment();

    var endOffset = (startOffset + length < bytes.length) ? startOffset + length : bytes.length;

    var hexRowString = "";
    var rawRowString = "";
    for (var b=startOffset; b<endOffset; b++)
    {
        if (b % 16 == 0)
        {
            // Add a new row to each section every 16 bytes and when done
            if (b !== 0) {
                this.addRow(b, hexRowString, rawRowString, offsetHolder, hexHolder, rawHolder);
                hexRowString = "";
                rawRowString = "";
            }
        }
        else if (b % 8 == 0)
        {
            // Add a double space to the hex and raw half way through each row (8 bytes)
            hexRowString += "&nbsp;&nbsp;";
            rawRowString += "&nbsp;&nbsp;";
        }
        else {
            // Add a simple spacer when not adding a new row or double space
            hexRowString += "&nbsp;"
            rawRowString += "&nbsp;"
        }

        // Append hex
        var hex = bytes[b].toString(16);
        if (hex.length == 1)
        {
            hex = "0" + hex;
        }
        hexRowString += hex;

        // Append text
        var text = String.fromCharCode(bytes[b]);
        // Only include displayable characters
        if (bytes[b] < 32 || bytes[b] > 126)
        {
            text = ".";
        }
        else if (bytes[b] == 32){
            // Need to encode space for cases where it is leading (' &nbsp;' is displayed as a single space)
            text = "&nbsp;";
        }
        rawRowString += text;

        // Handle last row that may be partial
        if (b == (endOffset - 1)) {
            this.addRow(b, hexRowString, rawRowString, offsetHolder, hexHolder, rawHolder);
        }
    }

    // Append the fragments to their respective divs
    this.viewerItems.offsetValue.appendChild(offsetHolder);
    this.viewerItems.hexValue.appendChild(hexHolder);
    this.viewerItems.rawValue.appendChild(rawHolder);

    this.currentLoadOffset = startOffset + length;
    // Not all bytes are shown, show continue loading link
    if (this.currentLoadOffset < bytes.length) {
        this.viewerItems.continueLink.style.display = "block";
    }
    else {
        this.viewerItems.continueLink.style.display = "none";
    }
};

/*
* Append a row to each of the holders
*/
Hexmash.prototype.addRow = function(offset, hexRowString, rawRowString, offsetHolder, hexHolder, rawHolder) {
    // When continuing, this will get called with no data
    if (hexRowString.length == 0) return;

    var offsetMod16 = offset % 16;
    var rowStart = offset - (offsetMod16 == 0 ? 16 : offsetMod16);

    var offsetBreak = document.createElement("br");
    var offsetString = String(rowStart);
    while (offsetString.length < 9) {
        if (offsetString.length == 4) {
            offsetString = " " + offsetString;
        }
        offsetString = "0" + offsetString;
    }
    var offsetSpan = document.createElement("span");
    offsetSpan.innerHTML = offsetString;
    offsetHolder.appendChild(offsetSpan);
    offsetHolder.appendChild(offsetBreak);


    var hexRowSpan = document.createElement("span");
    hexRowSpan.id = "hex" + rowStart;
    hexRowSpan.innerHTML = hexRowString;
    hexRowSpan.className = 'hex_row';
    var hexBreak = document.createElement("br");
    hexHolder.appendChild(hexRowSpan);
    hexHolder.appendChild(hexBreak);

    var rawRowSpan = document.createElement("span");
    rawRowSpan.id = "raw" + rowStart;
    rawRowSpan.innerHTML = rawRowString;
    rawRowSpan.className = 'raw_row';
    var rawBreak = document.createElement("br");
    rawHolder.appendChild(rawRowSpan);
    rawHolder.appendChild(rawBreak);
};

/*
* File browser change event, currently only load the first file selected
*/
Hexmash.prototype.onFileChange = function(evt) {
    var files = evt.target.files;
    var fileCount = files.length;

    // TODO: List files for seletion, for now only handle the last (Assume 1)
    if (fileCount > 0) {
        this.loadFile(files[0]);
    }
};

/*
* Drop event that get's the files passed in, currently only loads the first file
*/
Hexmash.prototype.onDrop = function(evt) {
    var files = evt.dataTransfer.files;
    var fileCount = files.length;

    // TODO: List files for seletion, for now only handle the last (Assume 1)
    if (fileCount > 0) {
        this.loadFile(files[0]);
    }

    // Prevent the browser from loading the file into the window
    this.preventDefault(evt);
};

/*
* Helper function to prevent default browser action and stop propagation
*/
Hexmash.prototype.preventDefault = function(evt) {
    evt.stopPropagation();
    evt.preventDefault();
};

/**
* Helper function to make element dropable - both the tool icon and the drop zone can
* have files dropped on them
*/
Hexmash.prototype.makeDropable = function(element) {
    element.addEventListener("dragenter", this.preventDefault, false);
    element.addEventListener("dragexit", this.preventDefault, false);
    element.addEventListener("dragover", this.preventDefault, false);
    element.addEventListener("drop", this.onDrop.bind(this), false);
};

/**
* Collapse/expand the dropzone
*/
Hexmash.prototype.showHideDropzone = function(evt) {
    if (!this.dropzoneVisible()) {
        this.loadingItems.dropzoneDiv.classList.remove('collapsed');
        window.scrollTo(window.scrollX, 0);
    }
    else {
        this.loadingItems.dropzoneDiv.classList.add('collapsed');
    }
};

/**
* Check whether the dropzone is shown
*/
Hexmash.prototype.dropzoneVisible = function() {
    return !this.loadingItems.dropzoneDiv.classList.contains('collapsed');
};

/**
* Initiate the loading of a file 
*/
Hexmash.prototype.loadFile = function(file) {
    this.viewerItems.offsetValue.innerHTML = "";
    this.viewerItems.hexValue.innerHTML = "";
    this.viewerItems.rawValue.innerHTML = "";

    this.toolbarItems.filenameDiv.innerHTML = file.name;
    this.toolbarItems.filesizeDiv.innerHTML = file.size;
    console.log("loading: " + file.name)

    this.reader.readAsArrayBuffer(file);
};

/**
* Scroll to the top of the page
*/
Hexmash.prototype.scrollToTop = function() {
    window.scrollTo(window.scrollX, 0);
}