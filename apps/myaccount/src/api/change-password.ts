/**
 * Copyright (c) 2023-2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { AsgardeoSPAClient, HttpInstance, HttpRequestConfig, HttpResponse } from "@asgardeo/auth-react";
import { IdentityAppsApiException } from "@wso2is/core/exceptions";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { ProfileConstants } from "../constants";
import { HttpMethods } from "../models";
import { store } from "../store";

/**
 * Get an axios instance bound to the Asgardeo SPA client (bearer token based).
 */
const httpClient: HttpInstance = AsgardeoSPAClient.getInstance().httpRequest.bind(
    AsgardeoSPAClient.getInstance()
);

/**
 * Updates the signed-in user's password.
 *
 * The flow is selected based on the `enable_basic_auth_handler` server configuration
 * (`[authentication] enable_basic_auth_handler` in deployment.toml), surfaced to the SPA as
 * `ui.isBasicAuthHandlerEnabled`:
 *
 * - When the basic auth handler is ENABLED (default) the legacy SCIM2 `/Me` flow is used
 * - When the basic auth handler is DISABLED, password update is routed through the dedicated password change REST API
 *   (`POST /api/users/v1/me/change-password`)
 *
 * @param currentPassword - currently registered password.
 * @param newPassword - newly assigned password.
 * @param isSubOrgUser - Whether the user belongs to a sub-organization.
 * @param userOrganizationHandle - The user's organization Handle.
 *
 * @returns A promise containing the response.
 */
export const updatePassword = (currentPassword: string, newPassword: string, isSubOrgUser: boolean = false,
    userOrganizationHandle: string = null): Promise<AxiosResponse | HttpResponse> => {

    const isBasicAuthHandlerEnabled: boolean =
        store.getState().config?.ui?.isBasicAuthHandlerEnabled ?? true;

    if (!isBasicAuthHandlerEnabled) {
        return updatePasswordViaPasswordChangeApi(currentPassword, newPassword, isSubOrgUser,
            userOrganizationHandle);
    }

    return updatePasswordViaScim2Me(currentPassword, newPassword, isSubOrgUser, userOrganizationHandle);
};

/**
 * Updates the password through the password change REST API (`POST /api/users/v1/me/change-password`).
 * Used when the basic auth handler is disabled. Authenticates with the user's bearer token and expects a
 * `204` response on success.
 *
 * @param currentPassword - currently registered password.
 * @param newPassword - newly assigned password.
 * @param isSubOrgUser - Whether the user belongs to a sub-organization.
 * @param userOrganizationHandle - The user's organization Handle.
 *
 * @returns A promise that resolves with the HTTP response when the request succeeds with status `204`.
 */
const updatePasswordViaPasswordChangeApi = (currentPassword: string, newPassword: string,
    isSubOrgUser: boolean = false, userOrganizationHandle: string = null): Promise<HttpResponse<unknown>> => {

    // In case the password contains non-ascii characters, converting to valid ascii format.
    const encoder: TextEncoder = new TextEncoder();
    const encodedCurrentPassword: string = String.fromCharCode(...encoder.encode(currentPassword));
    const url: string = store.getState().config.endpoints.passwordChange;
    let updatedUrl: string = url;

    if (isSubOrgUser) {
        updatedUrl = url.replace(/\/t\/[^/]+\//, `/t/${userOrganizationHandle}/`);
    }

    const requestConfig: HttpRequestConfig = {
        data: {
            currentPassword: encodedCurrentPassword,
            newPassword: newPassword
        },
        headers: {
            "Content-Type": "application/json"
        },
        method: HttpMethods.POST,
        url: updatedUrl
    };

    return httpClient(requestConfig)
        .then((response: HttpResponse) => {
            if (response.status !== 204) {
                throw new IdentityAppsApiException(
                    ProfileConstants.CHANGE_PASSWORD_INVALID_STATUS_CODE_ERROR,
                    null,
                    response.status,
                    response.request,
                    response,
                    response.config);
            }

            return Promise.resolve(response);
        })
        .catch((error: any) => {
            throw new IdentityAppsApiException(
                ProfileConstants.CHANGE_PASSWORD_ERROR,
                error.stack,
                error.code,
                error.request,
                error.response,
                error.config);
        });
};

/**
 * Updates the password through the legacy SCIM2 `/Me` endpoint using Basic Auth to validate the current
 * password. Used when the basic auth handler is enabled (default). Expects a `200` response on success.
 *
 * @remarks
 * We're using basic auth to validate the current password. If the password is different, the server
 * responds with a status code `401`. The callbacks handle 401 errors and terminate the session. To bypass
 * the callbacks, axios is used directly instead of the SDK http client.
 *
 * @param currentPassword - currently registered password.
 * @param newPassword - newly assigned password.
 * @param isSubOrgUser - Whether the user belongs to a sub-organization.
 * @param userOrganizationHandle - The user's organization Handle.
 *
 * @returns axiosResponse - a promise containing the response.
 */
const updatePasswordViaScim2Me = (currentPassword: string, newPassword: string, isSubOrgUser: boolean = false,
    userOrganizationHandle: string = null): Promise<AxiosResponse> => {

    const username: string = [
        store.getState().authenticationInformation?.profileInfo.userName,
        "@",
        userOrganizationHandle
    ].join("");
    // In case the password contains non-ascii characters, converting to valid ascii format.
    const encoder: TextEncoder = new TextEncoder();
    const encodedPassword: string = String.fromCharCode(...encoder.encode(currentPassword));
    const url: string = store.getState().config.endpoints.me;
    let updatedUrl: string = url;

    if (isSubOrgUser) {
        updatedUrl = url.replace(/\/t\/[^/]+\//, `/t/${userOrganizationHandle}/`);
    }

    const requestConfig: AxiosRequestConfig = {
        data: {
            Operations: [
                {
                    op: "add",
                    value: {
                        password: newPassword
                    }
                }
            ],
            schemas: [ "urn:ietf:params:scim:api:messages:2.0:PatchOp" ]
        },
        headers: {
            "Authorization": `Basic ${btoa(username + ":" + encodedPassword)}`,
            "Content-Type": "application/json"
        },
        method: HttpMethods.PATCH,
        url: updatedUrl,
        withCredentials: true
    };

    return axios.request(requestConfig)
        .then((response: AxiosResponse) => {
            if (response.status !== 200) {
                throw new IdentityAppsApiException(
                    ProfileConstants.CHANGE_PASSWORD_INVALID_STATUS_CODE_ERROR,
                    null,
                    response.status,
                    response.request,
                    response,
                    response.config);
            }

            return Promise.resolve(response);
        })
        .catch((error: any) => {
            throw new IdentityAppsApiException(
                ProfileConstants.CHANGE_PASSWORD_ERROR,
                error.stack,
                error.code,
                error.request,
                error.response,
                error.config);
        });
};
