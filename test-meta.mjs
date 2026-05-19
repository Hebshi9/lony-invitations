import fetch from 'node-fetch';

async function test() {
    const res = await fetch('https://graph.facebook.com/v21.0/1031606736708015', {
        headers: {
            'Authorization': 'Bearer EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG'
        }
    });
    console.log(await res.json());
}
test();
