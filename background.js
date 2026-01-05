chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "query_sparkai") {
        fetch('http://localhost:5000/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: message.query })
        })
            .then(response => response.json())
            .then(data => {
                if (data.response) {
                    sendResponse({ success: true, response: data.response });
                } else {
                    sendResponse({ success: false, error: data.error || "No valid response received" });
                }
            })
            .catch(error => {
                sendResponse({ success: false, error: "Network issue" });
            });
        return true;
    }

    if (message.action === "upload_file") {
        fetch('http://localhost:5000/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: message.filename,
                content: message.content
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.summary) {
                    sendResponse({ success: true, summary: data.summary });
                } else {
                    sendResponse({ success: false, error: data.error });
                }
            })
            .catch(error => {
                sendResponse({ success: false, error: "文件处理失败" });
            });
        return true;
    }
});