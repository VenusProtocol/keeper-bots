const getConverterConfigId = ({ converter, tokenToReceiveFromConverter, tokenToSendToConverter }: { converter: string, tokenToReceiveFromConverter: string, tokenToSendToConverter: string }) => {
	return `${converter}-${tokenToSendToConverter}-${tokenToReceiveFromConverter}`
}

export default getConverterConfigId;
