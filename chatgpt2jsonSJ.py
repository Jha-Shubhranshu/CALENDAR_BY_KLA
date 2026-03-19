import json
from datetime import datetime
from typing import Dict, List, Any, Optional

# Configuration
input_file = r"C:\Users\shubh\Desktop\desktop\Data Duta\Chatgpt Exports\my4feb26\conversations.json"
output_file = r"C:\Users\shubh\Desktop\Calendar_By_Kla\simplified_chatgptSj.json"

def traverse_conversation_tree(mapping: Dict, start_node: str = None) -> List[Dict]:
    """
    Traverse ChatGPT's tree structure and extract messages in order.
    
    Args:
        mapping: The mapping object from ChatGPT export
        start_node: Starting node ID (finds root if None)
        
    Returns:
        List of messages in chronological order
    """
    # Find root node if not provided
    if start_node is None:
        for node_id, node_data in mapping.items():
            if node_data.get("parent") is None:
                start_node = node_id
                break
    
    messages = []
    
    def traverse(node_id: str, parent_id: Optional[str] = None):
        if node_id not in mapping:
            return
        
        node = mapping[node_id]
        message = node.get("message")
        
        # Process message if it exists and has content
        if message and message.get("content"):
            author = message.get("author", {})
            role = author.get("role", "")
            
            # Skip system messages with empty content or hidden messages
            metadata = message.get("metadata", {})
            if metadata.get("is_visually_hidden_from_conversation"):
                pass  # Skip to children
            elif role in ["user", "assistant"]:
                content_data = message.get("content", {})
                content_type = content_data.get("content_type", "")
                parts = content_data.get("parts", [])
                
                # Extract content from parts
                text_content = []
                has_code = False
                has_image = False
                image_info = {}
                
                for part in parts:
                    if isinstance(part, str):
                        text_content.append(part)
                        # Check for code blocks
                        if "```" in part:
                            has_code = True
                    elif isinstance(part, dict):
                        # Handle image pointers
                        if part.get("content_type") == "image_asset_pointer":
                            has_image = True
                            image_info = {
                                "url": part.get("asset_pointer", ""),
                                "size": part.get("size_bytes", 0)
                            }
                
                # Build message object
                msg_obj = {
                    "id": message.get("id", ""),
                    "role": role,
                    "content": "\n".join(text_content) if text_content else "",
                    "content_type": "text",
                    "timestamp": datetime.fromtimestamp(
                        message.get("create_time", 0)
                    ).isoformat() + "Z" if message.get("create_time") else "",
                    "metadata": {},
                    "parent_id": parent_id
                }
                
                # Determine content type
                if has_code:
                    msg_obj["content_type"] = "code"
                    # Try to extract language
                    import re
                    match = re.search(r'```(\w+)', msg_obj["content"])
                    if match:
                        msg_obj["metadata"]["language"] = match.group(1)
                
                # Handle images
                if has_image:
                    msg_obj["content_type"] = "image"
                    if image_info.get("url"):
                        msg_obj["metadata"]["image_url"] = image_info["url"]
                
                # Add citations if present
                citations = metadata.get("citations", [])
                if citations:
                    msg_obj["metadata"]["citations"] = citations
                
                # Clean up empty metadata
                if not msg_obj["metadata"]:
                    del msg_obj["metadata"]
                
                # Only add if has content
                if msg_obj["content"].strip() or has_image:
                    messages.append(msg_obj)
        
        # Traverse children
        children = node.get("children", [])
        for child_id in children:
            traverse(child_id, node.get("id"))
    
    traverse(start_node)
    return messages


def parse_chatgpt_export(data: List[Dict]) -> List[Dict]:
    """
    Parse ChatGPT conversation export and convert to simplified format.
    
    Args:
        data: List of ChatGPT conversation objects
        
    Returns:
        List of simplified conversation objects
    """
    simplified_conversations = []
    
    for conversation in data:
        simplified = {
            "id": conversation.get("conversation_id", conversation.get("id", "")),
            "title": conversation.get("title", "Untitled Conversation"),
            "source": "chatgpt",
            "account": ".sj",
            "created_at": datetime.fromtimestamp(
                conversation.get("create_time", 0)
            ).isoformat() + "Z" if conversation.get("create_time") else "",
            "updated_at": datetime.fromtimestamp(
                conversation.get("update_time", 0)
            ).isoformat() + "Z" if conversation.get("update_time") else "",
            "messages": []
        }
        
        # Get mapping and traverse tree
        mapping = conversation.get("mapping", {})
        if mapping:
            messages = traverse_conversation_tree(mapping)
            simplified["messages"] = messages
        
        # Only add conversation if it has messages
        if simplified["messages"]:
            simplified_conversations.append(simplified)
    
    return simplified_conversations


def simplify_chatgpt_export(input_path: str, output_path: str):
    """
    Main function to simplify ChatGPT export.
    
    Args:
        input_path: Path to ChatGPT export JSON file
        output_path: Path to save simplified JSON
    """
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        simplified = parse_chatgpt_export(data)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(simplified, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully simplified {len(simplified)} conversations")
        print(f"Output saved to: {output_path}")
        
        total_messages = sum(len(conv["messages"]) for conv in simplified)
        print(f"Total messages: {total_messages}")
        
    except FileNotFoundError:
        print(f"Error: File '{input_path}' not found")
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in '{input_path}'")
    except Exception as e:
        print(f"Error: {str(e)}")


if __name__ == "__main__":
    simplify_chatgpt_export(input_file, output_file)