using System.Web;
using System.IO;
using Newtonsoft.Json;
using System.Collections.Generic;

public class SchemeAIO : IHttpHandler
{
	public void ProcessRequest(HttpContext context)
	{
		string currentDirectory = context.Server.MapPath("~");
		string relPath = context.Request.Url.AbsolutePath.ToString();
		string schemesDirectory = Path.Combine(currentDirectory, "fount-schemes");
		var jsonFiles = Directory.GetFiles(schemesDirectory, "*.json");
		var jsonObject = new Dictionary<string, string>();

		foreach (var file in jsonFiles)
		{
			string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(file);
			string fileContent = File.ReadAllText(file);
			// Deserialize and then serialize to remove unnecessary whitespace
			var deserializedContent = JsonConvert.DeserializeObject(fileContent);
			string cleanedJsonContent = JsonConvert.SerializeObject(deserializedContent, Formatting.None);
			jsonObject[fileNameWithoutExtension] = cleanedJsonContent;
		}

		string jsonResponse = JsonConvert.SerializeObject(jsonObject).Replace("}}\",\"", "}}\",\n\"");
		context.Response.ContentType = "application/json";
		context.Response.Write(jsonResponse);
	}

	public bool IsReusable
	{
		get { return false; }
	}
}
