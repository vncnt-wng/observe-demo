import express, { response, Express } from 'express';
const app: Express = express()
const port = 3001
import axios from 'axios';

import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import opentelemetry, { trace, context, propagation } from "@opentelemetry/api";
import { NodeSDK } from '@opentelemetry/sdk-node';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

import { traceFunction, traceFunctionMiddleWare, traceFunctionCallback, getTraceContextHeaders, setCorrectFileForMiddlewareSpan } from './trace_utils';
import { MediaManager } from './mediaManager';


const provider = new WebTracerProvider();
const mediaManager = new MediaManager

const ARTIST_SERVICE_ENDPOINT = "http://127.0.0.1:5000"

const collectorOptions = {
    url: "http://127.0.0.1:8000/v1/traces"
}

// const exporter = new ConsoleSpanExporter()
const exporter = new OTLPTraceExporter(collectorOptions) //ConsoleSpanExporter();
const processor = new BatchSpanProcessor(exporter);
provider.addSpanProcessor(processor);

provider.register();

const sdk = new NodeSDK({
    traceExporter: exporter,
    // instrumentations: [getNodeAutoInstrumentations()],
});

sdk
    .start()


app.use(express.json())
app.use(traceFunctionMiddleWare)

// app.post('/get_all_data_for_album_page', async (req, res) => {
//     setCorrectFileForMiddlewareSpan("express/app.ts")
//     const traceHeaders = getTraceStateHeader()
//     const artistNames = req.body.artistNames

//     const data = {}
//     console.log(artistNames)

//     for (const artist of artistNames) {
//         const otherAlbums = (
//             await axios.post(ARTIST_SERVICE_ENDPOINT + "/getOtherAlbumsForArtist", {
//                 headers: traceHeaders,
//                 body: {
//                     artistNames: [artist]
//                 }
//             })
//         ).data;
//         const otherAlbumIds = otherAlbums.map((a) => a.id)
//         console.log(otherAlbumIds)
//         const thumbnails = await mediaManager.getThumbnailsForIdsAsync(otherAlbumIds)
//         data[artist] = { "albums": otherAlbums, "thumbnails": thumbnails }
//         console.log(data)
//     }

//     res.send(data)
// })

app.post('/get_all_data_for_album_page', async (req, res) => {
    setCorrectFileForMiddlewareSpan("express/app.ts")
    const traceHeaders = getTraceContextHeaders()
    // console.log(traceHeaders)
    const albumId = req.body.albumId
    // console.log(req)
    // console.log(req.body)


    const artistNames = (
        await axios.post(ARTIST_SERVICE_ENDPOINT + "/get_artists_on_album",
            {
                body: { albumId: albumId }
            },
            { headers: traceHeaders },
        )).data


    const data = {}
    // console.log(artistNames)

    for (const artist of artistNames) {
        // console.log(traceHeaders)
        const otherAlbums = (
            await axios.post(ARTIST_SERVICE_ENDPOINT + "/get_other_albums_for_artist",
                {
                    body: { artistName: artist }
                },
                { headers: traceHeaders },
            )).data;
        const otherAlbumIds = otherAlbums.map((a) => a.id)
        // console.log(otherAlbumIds)
        const thumbnails = mediaManager.getThumbnailsForAlbums(otherAlbumIds)
        data[artist] = { "albums": otherAlbums, "thumbnails": thumbnails }
        // console.log(data)
    }

    res.send(data)
})

app.post('/get_thumbnails_for_albums', (req, res) => {
    setCorrectFileForMiddlewareSpan("express/app.ts")
    const albumIds = req.body.albumIds
    console.log(albumIds)
    console.log(req.body)
    const thumbnails = mediaManager.getThumbnailsForAlbums(albumIds)
    res.send(thumbnails)
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})