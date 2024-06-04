import axios from "axios";
import { Plugin } from "vite";
import { IndexHtmlTransformContext } from 'vite';
import transform from "./transform";
import { createRootIfNotExists, stringifyFromPattern } from "./utils";

export const PLUGIN_NAME = "vite-plugin-proxy-page";

export interface RootNode {
  prependTo?: string;
  id?: string;
}

export interface ProxyPageOptions {
  localEntryPoint: string;
  remoteUrl?: string;
  remoteUrlFunction?: (ctx?: IndexHtmlTransformContext) => string;
  remoteEntryPoint?: RegExp | string;
  rootNode?: RootNode;
  cacheHtml?: boolean;
}

export interface ProxyPlugin extends Plugin {
  transformIndexHtml: (_html: string, ctx?: IndexHtmlTransformContext) => Promise<any>;
  transform: (src: string, id: string) => any;
}

export const htmlCache = new Map();

export const proxyPage = ({
  localEntryPoint,
  remoteEntryPoint,
  remoteUrl,
  remoteUrlFunction,
  rootNode,
  cacheHtml = true,
}: ProxyPageOptions): ProxyPlugin => {
  return {
    name: PLUGIN_NAME,

    apply: "serve",

    enforce: "pre",

    configResolved({ root }) {
      createRootIfNotExists(root);
    },

    transform(src, id) {
      const entry = localEntryPoint.replace(/^\./, "");
      const pattern = new RegExp(stringifyFromPattern(entry));
      const isLocalEntryPoint = pattern.test(id);

      return isLocalEntryPoint ? `import.meta.hot; ${src}` : src;
    },

    async transformIndexHtml(_html: string, ctx?: IndexHtmlTransformContext): Promise<string> {
      const url = remoteUrlFunction ? remoteUrlFunction(ctx) : remoteUrl || '/';
      
      if (cacheHtml && htmlCache.get(url)) {
        return htmlCache.get(url);
      }

      const { origin } = new URL(url);
      const { data: html } = await axios.get(url, {
        responseType: "text",
      });

      const transformedHtml = transform({
        html,
        localEntryPoint,
        remoteEntryPoint,
        remoteHost: origin,
        rootNode,
      });

      cacheHtml && htmlCache.set(url, transformedHtml);

      return transformedHtml;
    },
  };
};
