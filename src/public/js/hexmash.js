function Hexmash (toolbarItems, loadingItems, viewerItems) {
    this.toolbarItems = toolbarItems;
    this.loadingItems = loadingItems;
    this.viewerItems  = viewerItems;

    // Hookup tools
    this.toolbarItems.openTool.addEventListener("click", this.showHideDropzone.bind(this), false);

    // Hookup drag and drop
    this.makeDropable(this.loadingItems.targetDiv);
    this.makeDropable(this.toolbarItems.openTool);

    // Hookup the browser and  link using the hidden file browser
    this.loadingItems.fileBrowser.addEventListener("change", this.onFileChange.bind(this), false);
    this.loadingItems.browseLink.addEventListener("click", this.loadingItems.fileBrowser.click.bind(this.loadingItems.fileBrowser), false);

    // Setup the reader
    this.reader = new FileReader()
    this.reader.onload = this.readerLoaded.bind(this);
    this.reader.onprogress = this.readerProgress.bind(this);
}

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
    this.loadBuffer(evt.target.result);
}

/*
* Take a buffer and load it into the viewer
*/
Hexmash.prototype.loadBuffer = function(buffer) {
    var bytes = new Uint8Array(buffer);

    var offsetHolder = document.createDocumentFragment();
    var hexHolder = document.createDocumentFragment();
    var rawHolder = document.createDocumentFragment();

    var byteCount = bytes.length;
    for (var b=0; b<byteCount; b++)
    {
        if (b % 16 == 0)
        {
            // Add a new row to each section every 16 bytes
            var offsetBreak = document.createElement("br");
            offsetHolder.appendChild(offsetBreak);
            var offset = String(b);
            while (offset.length < 9) {
                if (offset.length == 4) {
                    offset = " " + offset;
                }
                offset = "0" + offset;
            }
            var offsetSpan = document.createElement("span");
            offsetSpan.innerHTML = offset;
            offsetHolder.appendChild(offsetSpan);


            var hexBreak = document.createElement("br");
            hexHolder.appendChild(hexBreak);

            var rawBreak = document.createElement("br");
            rawHolder.appendChild(rawBreak);
        }
        else if (b % 8 == 0)
        {
            // Add a double space to the hex and raw half way through each row (8 bytes)
            var secondSpacer = document.createElement("span");
            secondSpacer.innerHTML = "&nbsp;&nbsp;"
            hexHolder.appendChild(secondSpacer);

            var rawSpacer = document.createElement("span");
            rawSpacer.innerHTML = "&nbsp;&nbsp;"
            rawHolder.appendChild(rawSpacer);
        }
        else {
            // Add a simple spacer when not adding a new row or double space
            var hexSpacer = document.createElement("span");
            hexSpacer.innerHTML = "&nbsp;"
            hexHolder.appendChild(hexSpacer);

            var rawSpacer = document.createElement("span");
            rawSpacer.innerHTML = "&nbsp;"
            rawHolder.appendChild(rawSpacer);
        }

        // Append hex
        var hexSpan = document.createElement("span");
        var hex = bytes[b].toString(16);
        if (hex.length == 1)
        {
            hex = "0" + hex;
        }
        hexSpan.innerHTML = hex;
        hexHolder.appendChild(hexSpan);

        // Append text
        var rawSpan = document.createElement("span");
        var text = String.fromCharCode(bytes[b]);
        // Only include displayable characters
        if (bytes[b] < 32 || bytes[b] > 126)
        {
            text = ".";
        }
        rawSpan.innerHTML = text;
        rawHolder.appendChild(rawSpan);
    }

    // Append the fragments to their respective divs
    this.viewerItems.offsetValue.appendChild(offsetHolder);
    this.viewerItems.hexValue.appendChild(hexHolder);
    this.viewerItems.rawValue.appendChild(rawHolder);
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
}

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
}

/*
* Helper function to prevent default browser action and stop propagation
*/
Hexmash.prototype.preventDefault = function(evt) {
    evt.stopPropagation();
    evt.preventDefault();
}

/**
* Helper function to make element dropable - both the tool icon and the drop zone can
* have files dropped on them
*/
Hexmash.prototype.makeDropable = function(element) {
    element.addEventListener("dragenter", this.preventDefault, false);
    element.addEventListener("dragexit", this.preventDefault, false);
    element.addEventListener("dragover", this.preventDefault, false);
    element.addEventListener("drop", this.onDrop.bind(this), false);
}

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
    
}

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
}