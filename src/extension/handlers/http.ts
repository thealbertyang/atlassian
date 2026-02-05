import type { AxiosRequestConfig } from "axios";
import { AxiosService } from "../service/axios.service";

const axiosService = new AxiosService();

export const createHttpHandlers = () => ({
  axiosGet: (url: string, config?: AxiosRequestConfig): Promise<unknown> => {
    return axiosService.get(url, config);
  },

  axiosPost: (url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown> => {
    return axiosService.post(url, data, config);
  },

  axiosPut: (url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown> => {
    return axiosService.put(url, data, config);
  },

  axiosDelete: (url: string, config?: AxiosRequestConfig): Promise<unknown> => {
    return axiosService.delete(url, config);
  },
});
