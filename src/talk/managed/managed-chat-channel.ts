/*
 * Created on Mon Jun 15 2020
 *
 * Copyright (c) storycraft. Licensed under the MIT Licence.
 */

import { OpenLinkChannel } from "../open/open-link";
import { OpenMemberStruct, OpenLinkReactionInfo } from "../struct/open/open-link-struct";
import { ChatUser, ChatUserInfo } from "../user/chat-user";
import { OpenMemberType } from "../open/open-link-type";
import { Long } from "bson";
import { PrivilegeMetaContent, ProfileMetaContent, TvMetaContent, TvLiveMetaContent, ChannelMetaStruct, GroupMetaContent, LiveTalkCountMetaContent, ChannelMetaType, ChannelClientMetaStruct } from "../struct/channel-meta-struct";
import { ChatContent } from "../chat/attachment/chat-attachment";
import { MessageTemplate } from "../chat/template/message-template";
import { Chat } from "../chat/chat";
import { ChannelSettings } from "../channel/channel-settings";
import { ChannelManager } from "../channel/channel-manager";
import { ChannelDataStruct } from "../struct/channel-data-struct";
import { EventEmitter } from "events";
import { ChatChannel, OpenChatChannel } from "../channel/chat-channel";
import { MemberStruct } from "../struct/member-struct";
import { ManagedOpenChatUserInfo, ManagedChatUserInfo } from "./managed-chat-user";
import { RequestResult } from "../request/request-result";
import { OpenProfileTemplates } from "../open/open-link-profile-template";


export abstract class ManagedBaseChatChannel<I extends ChatUserInfo = ChatUserInfo> extends EventEmitter implements ChatChannel<I> {

    private lastChat: Chat | null;

    private roomImageURL: string;
    private roomFullImageURL: string;

    private name: string;

    private clientRoomImageURL: string;
    private clientRoomFullImageURL: string;

    private clientName: string;

    private clientPushSound: string;

    private isFavorite: boolean;

    private channelMetaList: ChannelMetaStruct[];

    private userInfoMap: Map<string, I>;

    constructor(private manager: ChannelManager, private id: Long, private dataStruct: ChannelDataStruct) {
        super();

        this.lastChat = null;

        this.roomImageURL = '';
        this.roomFullImageURL = '';

        this.name = '';

        this.clientRoomImageURL = '';
        this.clientRoomFullImageURL = '';

        this.clientName = '';
        this.clientPushSound = '';
        this.isFavorite = false;

        this.userInfoMap = new Map();

        this.channelMetaList = [];
    }

    get Client() {
        return this.manager.Client;
    }

    get ChatManager() {
        return this.Client.ChatManager;
    }

    get LastChat() {
        return this.lastChat;
    }

    get Id() {
        return this.id;
    }

    get Type() {
        return this.dataStruct.type;
    }

    get PushAlert() {
        return this.dataStruct.pushAlert;
    }

    get Name() {
        return this.name;
    }

    get IsFavorite() {
        return this.isFavorite;
    }

    get RoomImageURL() {
        return this.roomImageURL;
    }

    get RoomFullImageURL() {
        return this.roomFullImageURL;
    }

    get ClientName() {
        return this.clientName;
    }

    get ClientRoomImageURL() {
        return this.clientRoomImageURL;
    }

    get ClientRoomFullImageURL() {
        return this.clientRoomFullImageURL;
    }

    get ChannelMetaList() {
        return this.channelMetaList;
    }

    getUserInfoList() {
        return Array.from(this.userInfoMap.values());
    }

    hasUserInfo(id: Long) {
        return this.userInfoMap.has(id.toString());
    }

    getUserInfoId(id: Long) {
        let info = this.userInfoMap.get(id.toString()) || null;

        if (!info && this.Client.ClientUser.Id.equals(id)) return this.Client.ClientUser.MainUserInfo as I;

        return info;
    }

    getUserInfo(user: ChatUser) {
        return this.getUserInfoId(user.Id);
    }

    async markChannelRead(lastWatermark: Long) {
        await this.manager.markRead(this, lastWatermark);
    }

    async sendText(...textFormat: (string | ChatContent)[]): Promise<Chat | null> {
        return this.ChatManager.sendText(this, ...textFormat);
    }
    
    async sendTemplate(template: MessageTemplate): Promise<Chat | null> {
        return this.ChatManager.sendTemplate(this, template);
    }

    async leave(block: boolean = false): Promise<RequestResult<boolean>> {
        return this.manager.leave(this, block);
    }

    async setChannelSettings(settings: ChannelSettings): Promise<RequestResult<boolean>> {
        return this.manager.updateChannelSettings(this, settings);
    }

    async setTitleMeta(title: string): Promise<RequestResult<boolean>> {
        return this.manager.setTitleMeta(this, title);
    }

    async setNoticeMeta(notice: string): Promise<RequestResult<boolean>> {
        return this.manager.setNoticeMeta(this, notice);
    }

    async setPrivilegeMeta(content: PrivilegeMetaContent): Promise<RequestResult<boolean>> {
        return this.manager.setPrivilegeMeta(this, content);
    }

    async setProfileMeta(content: ProfileMetaContent): Promise<RequestResult<boolean>> {
        return this.manager.setProfileMeta(this, content);
    }

    async setTvMeta(content: TvMetaContent): Promise<RequestResult<boolean>> {
        return this.manager.setTvMeta(this, content);
    }

    async setTvLiveMeta(content: TvLiveMetaContent): Promise<RequestResult<boolean>> {
        return this.manager.setTvLiveMeta(this, content);
    }

    async setLiveTalkCountMeta(content: LiveTalkCountMetaContent): Promise<RequestResult<boolean>> {
        return this.manager.setLiveTalkCountMeta(this, content);
    }

    async setGroupMeta(content: GroupMetaContent): Promise<RequestResult<boolean>> {
        return this.manager.setGroupMeta(this, content);
    }

    updateData(dataStruct: ChannelDataStruct) {
        this.dataStruct = dataStruct;
    }

    protected updateRoomName(name: string) {
        this.name = name;
    }

    updateMetaList(metaList: ChannelMetaStruct[]) {
        for (let meta of metaList) {
            this.updateMeta(meta);
        }
    }

    updateMeta(changed: ChannelMetaStruct) {
        let len = this.channelMetaList.length;
        for (let i = 0; i < len; i++) {
            let meta = this.channelMetaList[i];
            
            if (meta.type === changed.type) {
                this.channelMetaList.splice(i, 1);
                break;
            }
        }

        this.addMeta(changed);
    }

    protected addMeta(meta: ChannelMetaStruct) {
        this.channelMetaList.push(meta);

        if (meta.type === ChannelMetaType.TITLE) {
            this.updateRoomName(meta.content);
        }

        if (meta.type === ChannelMetaType.PROFILE) {
            try {
                let content = JSON.parse(meta.content) as ProfileMetaContent;
                
                this.roomImageURL = content.imageUrl;
                this.roomFullImageURL = content.fullImageUrl;
            } catch (e) {

            }
        }
    }

    updateClientMeta(clientMeta: ChannelClientMetaStruct) {
        if (clientMeta.name) this.clientName = clientMeta.name;

        if (clientMeta.imageUrl) this.clientRoomImageURL = clientMeta.imageUrl;
        if (clientMeta.full_image_url) this.clientRoomFullImageURL = clientMeta.full_image_url;

        if (clientMeta.push_sound) {}//this.clientPushSound = clientMeta.push_sound;

        if (clientMeta.favorite) this.isFavorite = clientMeta.favorite;
    }

    updateChannelSettings(settings: ChannelSettings) {
        if (settings.pushAlert) this.dataStruct.pushAlert = settings.pushAlert || true;
    }

    updateLastChat(chat: Chat) {
        this.lastChat = chat;
    }

    updateUserInfo(userId: Long, userInfo: I | null) {
        if (userInfo) this.userInfoMap.set(userId.toString(), userInfo);
        else this.userInfoMap.delete(userId.toString());
    }

    abstract isOpenChat(): boolean;

}

export class ManagedChatChannel extends ManagedBaseChatChannel<ManagedChatUserInfo> {
    
    updateMemberList(memberList: MemberStruct[]) {
        for (let memberStruct of memberList) {
            let userInfo = this.Client.UserManager.getInfoFromStruct(memberStruct) as ManagedChatUserInfo;
            this.updateUserInfo(userInfo.Id, userInfo);
        }
    }

    isOpenChat() {
        return false;
    }

}

export class ManagedMemoChatChannel extends ManagedBaseChatChannel<ManagedChatUserInfo> {

    isOpenChat() {
        return false;
    }

}

export class ManagedOpenChatChannel extends ManagedBaseChatChannel<ManagedOpenChatUserInfo> implements OpenChatChannel {

    //lazy initialization hax
    private clientUserInfo: ManagedOpenChatUserInfo | null;

    constructor(manager: ChannelManager, id: Long, dataStruct: ChannelDataStruct, private linkId: Long, private openToken: number, private openLink: OpenLinkChannel) {
        super(manager, id, dataStruct);

        this.clientUserInfo = null;
    }

    get ClientUserInfo() {
        return this.clientUserInfo!;
    }

    get Name() {
        return super.Name || this.openLink.LinkName;
    }

    get LinkId() {
        return this.linkId;
    }

    get OpenToken() {
        return this.openToken;
    }

    getOpenLink() {
        return this.openLink;
    }

    isOpenChat(): true {
        return true;
    }

    getUserInfoId(id: Long) {
        if (this.clientUserInfo && this.clientUserInfo.Id.equals(id)) return this.clientUserInfo;

        return super.getUserInfoId(id);
    }

    getMemberType(user: ChatUser): OpenMemberType {
        return this.getMemberTypeId(user.Id);
    }

    getMemberTypeId(userId: Long): OpenMemberType {
        let info = this.getUserInfoId(userId);

        if (info) return info.MemberType;

        return OpenMemberType.NONE;
    }

    canManageChannel(user: ChatUser) {
        return this.canManageChannelId(user.Id);
    }

    canManageChannelId(userId: Long) {
        return this.isManagerId(userId) || userId.equals(this.openLink.LinkOwnerInfo.Id);
    }

    isManager(user: ChatUser) {
        return this.isManagerId(user.Id);
    }

    isManagerId(userId: Long) {
        return this.getMemberTypeId(userId) === OpenMemberType.MANAGER;
    }

    async kickMember(user: ChatUser): Promise<RequestResult<boolean>> {
        return this.kickMemberId(user.Id);
    }

    async kickMemberId(userId: Long): Promise<RequestResult<boolean>> {
        return this.Client.OpenLinkManager.kickMember(this, userId);
    }

    async deleteLink(): Promise<RequestResult<boolean>> {
        return this.Client.OpenLinkManager.deleteLink(this.linkId);
    }

    async hideChat(chat: Chat): Promise<RequestResult<boolean>> {
        return this.hideChatId(chat.LogId);
    }

    async hideChatId(logId: Long): Promise<RequestResult<boolean>> {
        return this.Client.OpenLinkManager.hideChat(this, logId);
    }

    async changeProfile(profile: OpenProfileTemplates): Promise<RequestResult<boolean>> {
        return this.Client.OpenLinkManager.changeProfile(this, profile);
    }

    async setOpenMemberType(user: ChatUser, memberType: OpenMemberType) {
        return this.setOpenMemberTypeId(user.Id, memberType);
    }

    async setOpenMemberTypeId(userId: Long, memberType: OpenMemberType): Promise<RequestResult<boolean>> {
        return this.Client.OpenLinkManager.setOpenMemberType(this, userId, memberType);
    }

    requestReactionInfo(): Promise<RequestResult<OpenLinkReactionInfo>> {
        return this.Client.OpenLinkManager.requestReactionInfo(this.linkId);
    }

    async setReacted(reacted: boolean): Promise<RequestResult<boolean>> {
        return this.Client.OpenLinkManager.setLinkReacted(this.linkId, reacted);
    }

    updateLink(link: OpenLinkChannel) {
        this.openLink = link;
    }

    updateMemberList(memberList: OpenMemberStruct[]) {
        memberList.forEach(this.updateMember.bind(this));
    }

    updateMember(memberStruct: OpenMemberStruct) {
        let userInfo = this.Client.UserManager.getInfoFromStruct(memberStruct) as ManagedOpenChatUserInfo;

        if (this.Client.ClientUser.Id.equals(userInfo.Id)) {
            this.clientUserInfo = userInfo;
            return;
        }

        this.updateUserInfo(userInfo.Id, userInfo);
    }

}