import { createAuthClient } from "better-auth/react";
import {usernameClient,phoneNumberClient} from "better-auth/client/plugins";
export const authClient = createAuthClient({plugins:[usernameClient({displayUsername:false}),phoneNumberClient()]});
