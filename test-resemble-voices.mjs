import fetch from 'node-fetch';
import fs from 'fs';

async function listVoices() {
    const apiKey = "cZxhQo2aNPFbr5fZVAw5agtt";
    let page = 1;
    let allVoices = [];

    while (true) {
        const response = await fetch(`https://app.resemble.ai/api/v2/voices?page=${page}&page_size=50`, {
            headers: {
                "Authorization": `Token token=${apiKey}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();
        if (!data.success || !data.items || data.items.length === 0) break;

        allVoices = allVoices.concat(data.items);
        if (page >= data.num_pages) break;
        page++;
    }

    const englishVoices = allVoices.filter(v => v.default_language && v.default_language.startsWith('en'));

    const mapped = englishVoices.map(v => ({
        name: v.name,
        uuid: v.uuid,
        lang: v.default_language
    }));

    fs.writeFileSync('english_voices.json', JSON.stringify(mapped, null, 2));
    console.log("Dumped english voices to english_voices.json");
}
listVoices();
