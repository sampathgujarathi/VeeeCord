import { addPreSendListener, removePreSendListener } from "@api/MessageEvents";
import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { Settings } from "@api/Settings";
import { Devs } from "@utils/constants";

const settings = definePluginSettings(
    {
        blockedWords: {
            type: OptionType.STRING,
            description: "Strings not to capitilise (seperate with a comma)",
            default: "http, ok"
        },
    }
);

export default definePlugin({
    name: `WriteUpperCase`,
    description: "Changes the first Letter of each Sentence in Message Inputs to Uppercase (Port from bd)",
    authors: [
        Devs.Samwich
    ],
    patches: [],

    start() {
        this.preSend = addPreSendListener(async (_, message) => {
            message.content = textProcessing(message.content);
        });
    },
    stop() {
        this.preSend = removePreSendListener(async (_, message) => {
            message.content = textProcessing(message.content);
        });
    },
    settings
});


// this is probably really badly coded im so fucking sorry :skull:
function textProcessing(textInput: string): string {
    let sentences = textInput.split(/(?<=\w\.)\s/);
    let blockedWordsArray: string[] = Settings.plugins.WriteUpperCase.blockedWords.split(", ");

    return sentences.map(element => {
        if (!blockedWordsArray.some(word => element.toLowerCase().startsWith(word.toLocaleLowerCase()))) {
            return element.charAt(0).toUpperCase() + element.slice(1);
        } else {
            return element;
        }
    }).join(" ");
}
