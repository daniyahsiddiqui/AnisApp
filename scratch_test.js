const surahData = {
    number: 2,
    ayahs: [
        {
            audio: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/8.mp3",
            text: "Text of Ayah 1"
        }
    ]
};

const sampleAudio = surahData.ayahs[0].audio;
const bismillahUrl = sampleAudio.substring(0, sampleAudio.lastIndexOf('/') + 1) + '1.mp3';

console.log("bismillahUrl:", bismillahUrl);
