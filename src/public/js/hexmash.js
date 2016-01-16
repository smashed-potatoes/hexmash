function Hexmash (toolbarItems, loadingItems, viewerItems) {
    this.buffer = null;     // The file buffer
    this.chunkSize = 10240; // The number of bytes to load into the viewer at a time
    this.currentLoadOffset = 0;

    this.toolbarItems = toolbarItems;
    this.loadingItems = loadingItems;
    this.viewerItems  = viewerItems;

    // Hookup tools
    this.toolbarItems.openTool.addEventListener("click", this.showHideDropzone.bind(this), false);

    // Hookup drag and drop
    this.makeDropable(this.loadingItems.targetDiv);
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

    // Hookup the continue loading link and continuous loading
    this.viewerItems.continueLink.addEventListener("click", this.continueLoading.bind(this));
    document.addEventListener("scroll", function(evt) {
        // If there is more to load and the user is 1 screen away from the bottom, start loading the next chunk
        if (this.buffer !== null && document.body.scrollHeight - window.scrollY < window.innerHeight * 2 
            && this.currentLoadOffset < this.buffer.byteLength) {
            this.continueLoading();
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
    var columnWidth = null;

    // Get the row number from the ID if a hex or raw row are the target
    if (target.classList.contains('hex_row')) {
        row = target.id.replace('hex', '');
        columnWidth = this.viewerItems.hexValue.offsetWidth / 16;
    }
    else if (target.classList.contains('raw_row')) {
        row = target.id.replace('raw', '');
        columnWidth = this.viewerItems.rawValue.offsetWidth / 16;
    }

    if (row !== null && columnWidth !== null) {
        var column = Math.floor(evt.offsetX / columnWidth);
        var hexRow = document.getElementById('hex' + row);
        var rawRow = document.getElementById('raw' + row);

        // Highlight both the corresponding hex and text for the byte
        this.highlightByte(hexRow, column, 2, this.currentHexHighlight, 'hex_cell_highlighted');
        this.highlightByte(rawRow, column, 1, this.currentRawHighlight, 'raw_cell_highlighted');
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

    var byteCount = (startOffset + length < bytes.length) ? startOffset + length : bytes.length - startOffset;

    var hexRowString = "";
    var rawRowString = "";
    for (var b=startOffset; b<byteCount; b++)
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
        rawRowString += text;

        // Handle last row that may be partial
        if (b == (byteCount - 1)) {
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
    if (this.loadingItems.targetDiv.classList.contains('collapsed')) {
        this.loadingItems.targetDiv.classList.remove('collapsed');
    }
    else {
        this.loadingItems.targetDiv.classList.add('collapsed');
    }
};

/**
* Initiate the loading of a file 
*/
Hexmash.prototype.loadFile = function(file) {
    this.loadingItems.targetDiv.classList.add('collapsed');

    this.viewerItems.offsetValue.innerHTML = "";
    this.viewerItems.hexValue.innerHTML = "";
    this.viewerItems.rawValue.innerHTML = "";

    this.toolbarItems.filenameDiv.innerHTML = file.name;
    this.toolbarItems.filesizeDiv.innerHTML = file.size;
    console.log("loading: " + file.name)

    this.reader.readAsArrayBuffer(file);
};