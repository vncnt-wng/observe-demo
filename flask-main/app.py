from flask import Flask, request
from opentelemetry.trace.status import StatusCode
from trace_utils import trace_function, trace, add_trace_headers
import json
import requests

PORT = 8001

app = Flask(__name__)


ALBUMS_ENDPOINT = "http://127.0.0.1:5000"
MEDIA_ENDPOINT = "http://127.0.0.1:3001"


@app.route("/get_other_albums_from_artists", methods=["POST"])
@trace_function
def get_other_albums_from_artists():
    body = json.loads(request.data)
    albumId = body["albumId"]
    trace_headers = add_trace_headers({})

    album_data_by_artist = {}

    artists = requests.post(
        ALBUMS_ENDPOINT + "/get_artists_on_album",
        headers=trace_headers,
        json={"albumId": albumId},
    ).json()

    for artist in artists:
        albums = requests.post(
            ALBUMS_ENDPOINT + "/get_other_albums_for_artist",
            headers=trace_headers,
            json={"artistName": artist},
        ).json()

        ids = [album["id"] for album in albums]

        thumbnails = requests.post(
            MEDIA_ENDPOINT + "/get_thumbnails_for_albums",
            headers=trace_headers,
            json={"albumIds": ids},
        ).json()
        album_data_by_artist[artist] = {"albums": albums, "thumbnails": thumbnails}

    return album_data_by_artist


if __name__ == "__main__":
    app.run(threaded=True, debug=False, host="0.0.0.0", port=PORT)
