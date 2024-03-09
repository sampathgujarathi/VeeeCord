import { addContextMenuPatch, findGroupChildrenByChildId, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { Menu } from "@webpack/common";
import type { Channel, Guild, User } from "discord-types/general";
import { findByPropsLazy } from "@webpack";
import { Toasts } from "@webpack/common";
const Patch: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild; }) => () => {
    const group = findGroupChildrenByChildId("privacy", children);

    group?.push(
        <Menu.MenuItem id="download-parent" label="Download">
            <Menu.MenuItem id="media-header" label="Media">
                <Menu.MenuItem id="icon-download" label="Icon" action={() => downloadServerIcon(guild)}></Menu.MenuItem>    
                <Menu.MenuItem id="banner-download" label="Banner" action={() => downloadServerBanner(guild)}></Menu.MenuItem>   
                <Menu.MenuItem id="emoji.download" label="Emojis" action={() => zipServerEmojis(guild)}></Menu.MenuItem>         
            </Menu.MenuItem>
            <Menu.MenuItem id="data-header" label="Data">
                <Menu.MenuItem id="role-download" label="Roles" action={() => downloadServerRoles(guild)}></Menu.MenuItem>                
            </Menu.MenuItem>



        </Menu.MenuItem>
    );
};
const BannerStore = findByPropsLazy("getGuildBannerURL");

export default definePlugin({
    name: "Downloader",
    description: "Adds multiple context menu options for downloading a servers data.",
    authors: [
        {
            id: 976176454511509554n,
            name: "Samwich",
        },
    ],
    start() {
        addContextMenuPatch(["guild-context", "guild-header-popout"], Patch);
    },

    stop() {
        removeContextMenuPatch(["guild-context", "guild-header-popout"], Patch);
    }
});

async function zipServerEmojis(guild : Guild) {
    await fetch("https://unpkg.com/fflate@0.8.0").then(r => r.text()).then(eval);
    const emojis = Vencord.Webpack.Common.EmojiStore.getGuilds()[guild.id]?.emojis;
    if (!emojis) {
        return console.log("Server not found!");
    }

    const fetchEmojis = async e => {
        const filename = e.id + (e.animated ? ".gif" : ".png");
        const emoji = await fetch("https://cdn.discordapp.com/emojis/" + filename + "?size=512&quality=lossless").then(res => res.blob());
        return { file: new Uint8Array(await emoji.arrayBuffer()), filename };
    };    
    const emojiPromises = emojis.map(e => fetchEmojis(e));

    Promise.all(emojiPromises)
        .then(results => {
            const emojis = fflate.zipSync(Object.fromEntries(results.map(({ file, filename }) => [filename, file])));
            const blob = new Blob([emojis], { type: "application/zip" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${guild.name}-emojis.zip`;
            link.click();
            link.remove();
        })
        .catch(error => {
            console.error(error);
        });
}

async function downloadServerIcon(guild : Guild)
{
    let iconurl = guild.getIconURL(1024, true);
    console.log(iconurl);   
    const response = await fetch(iconurl);
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${guild.name}-icon.webp`
    link.click();
    link.remove();
}
async function downloadServerBanner(guild : Guild)
{
    if(guild.premiumSubscriberCount < 7)
    {
        Toasts.show(
            {
                id: Toasts.genId(),
                message: "This guild doesn't have a banner!",
                type: Toasts.Type.FAILURE
            });
        return;
    }
    let {id, banner} = guild;
    let bannerURL = BannerStore.getGuildBannerURL({
        id,
        banner,
    }, true)
    console.log(bannerURL);   
    const response = await fetch(bannerURL);
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${guild.name}-banner.${bannerURL.indexOf(".gif") ?  ".gif": ".webp"}`
    link.click();
    link.remove();
}
async function downloadServerRoles(guild : Guild)
{
    let rolesJson = JSON.stringify(guild.roles, null, 2);
    const blob = new Blob([rolesJson], { type: "application/json"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${guild.name}-roles.json`
    link.click();
    link.remove();
}