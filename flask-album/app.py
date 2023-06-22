from flask import Flask, request
from time import sleep
from opentelemetry.trace.status import StatusCode
from trace_utils import trace_function, trace, get_trace_context_headers
from albums_manager import AlbumsManager
import json

PORT = 8000

app = Flask(__name__)
albums_manager = AlbumsManager()


@app.route("/get_artists_on_album", methods=["POST"])
@trace_function
def get_artists_on_album():
    print(request.data)
    body = json.loads(request.data)
    albumId = body["albumId"]
    names = albums_manager.get_artists_on_album(albumId)
    return names


@app.route("/get_other_albums_for_artist", methods=["POST"])
@trace_function
def get_other_albums_for_artist():
    body = json.loads(request.data)
    print(body)
    artistName = body["artistName"]
    albums = albums_manager.get_albums_by_artist(artistName)
    return albums


if __name__ == "__main__":
    app.run(threaded=True, debug=False, host="0.0.0.0", port=PORT)
