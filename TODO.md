# Project To-Do

## Implement Large File Transfer Support (Streaming Download)

**Goal:** Overcome the receiver-side memory limitation to allow for very large file transfers.

**Plan:**
- Integrate the **File System Access API**.
- Modify the receiver's logic to stream incoming file chunks directly to a file on the user's disk, instead of buffering them in memory.
- This will involve:
    1. Using `showSaveFilePicker()` to prompt the user for a save location at the beginning of the transfer.
    2. Creating a `writableStream` from the resulting file handle.
    3. Writing each received data chunk to the `writableStream`.
    4. Closing the stream upon transfer completion.

**Note:** This will introduce a browser compatibility limitation, as the File System Access API is not supported in Safari.
